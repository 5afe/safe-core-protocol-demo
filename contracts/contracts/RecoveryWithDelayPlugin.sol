// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;
import {ISafe} from "@safe-global/safe-core-protocol/contracts/interfaces/Accounts.sol";
import {ISafeProtocolPlugin} from "@safe-global/safe-core-protocol/contracts/interfaces/Integrations.sol";
import {ISafeProtocolManager} from "@safe-global/safe-core-protocol/contracts/interfaces/Manager.sol";
import {BasePluginWithEventMetadata, PluginMetadata} from "./Base.sol";
import {SafeTransaction, SafeRootAccess, SafeProtocolAction} from "@safe-global/safe-core-protocol/contracts/DataTypes.sol";

/**
 * @title RecoveryPlugin - A contract compatible with Safe{Core} Protocol that replaces a specified owner for a Safe by a non-owner account.
 * @notice This contract should be listed in a Registry and enabled as a Plugin for an account through a Manager to be able to intiate recovery mechanism.
 * @author Akshay Patel - @akshay-ap
 */
contract RecoveryWithDelayPlugin is BasePluginWithEventMetadata {
    // Constants
    bytes32 public constant DOMAIN_SEPARATOR_TYPEHASH = keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 public constant DELAYED_RECOVERY_TRANSACTION_TYPEHASH =
        keccak256(
            "DelayedRecoveryTransaction(address recoverer,address manager,address account,address prevOwner,address oldOwner,address newOwner,uint256 nonce)"
        );

    struct Announcement {
        uint64 executionTime; // Block time in seconds when the announced transaction can be executed
        uint16 validityDurationMin; // Duration in minutes the announcement is valid after delay is over (0 is valid forever)
        bool executed; // Flag if the announced transaction was executed
    }

    // Contract storage

    // Only recoverer can initiate recovery process
    address immutable recoverer;

    // Transaction Hash -> Announcement
    mapping(bytes32 => Announcement) public announcements;

    // Events
    event NewRecoveryAnnouncement();
    event RecoveryAccouncementCancelled();
    event OwnerReplaced(address account, address oldowner, address newOwner);

    // Errors
    error CallerNotValidRecoverer();
    error NonceAlreadyUsed(uint256 nonce);
    error TransactionAlreadyExecuted(bytes32 txHash);
    error TransactionAlreadyScheduled(bytes32 txHash);
    error ExecutiontimeShouldBeInFuture();
    error TransactionNotFound(bytes32 txHash);
    error TransactionExecutionNotAllowedYet(bytes32 txHash);

    constructor(
        address _recoverer
    )
        BasePluginWithEventMetadata(
            PluginMetadata({name: "Recovery Plugin", version: "1.0.0", requiresRootAccess: true, iconUrl: "", appUrl: ""})
        )
    {
        recoverer = _recoverer;
    }

    modifier onlyRecoverer() {
        if (msg.sender != recoverer) {
            revert CallerNotValidRecoverer();
        }
        _;
    }

    /**
     * @notice Executes a Safe transaction if the caller is whitelisted for the given Safe account.
     * @param manager Address of the Safe{Core} Protocol Manager.
     * @param safe Safe account whose owner has to be recovered
     * @param prevOwner Owner that pointed to the owner to be replaced in the linked list
     * @param oldOwner Owner address to be replaced.
     * @param newOwner New owner address.
     */
    function executeFromPlugin(
        ISafeProtocolManager manager,
        ISafe safe,
        address prevOwner,
        address oldOwner,
        address newOwner,
        uint256 nonce
    ) external returns (bytes memory data) {
        bytes32 txHash = getTransactionHash(address(manager), address(safe), prevOwner, oldOwner, newOwner, nonce);

        if (!announcements[txHash].executed) {
            revert TransactionAlreadyExecuted(txHash);
        }

        if (announcements[txHash].executionTime < block.timestamp) {
            revert TransactionExecutionNotAllowedYet(txHash);
        }

        announcements[txHash].executed = true;

        bytes memory txData = abi.encodeWithSignature("swapOwner(address,address,address)", prevOwner, oldOwner, newOwner);

        SafeProtocolAction memory safeProtocolAction = SafeProtocolAction(payable(address(safe)), 0, txData);
        SafeRootAccess memory safeTx = SafeRootAccess(safeProtocolAction, 0, "");
        (data) = manager.executeRootAccess(safe, safeTx);

        emit OwnerReplaced(address(safe), oldOwner, newOwner);
    }

    /// @dev Returns the chain id used by this contract.
    function getChainId() public view returns (uint256) {
        uint256 id;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            id := chainid()
        }
        return id;
    }

    function getTransactionHashData(
        address manager,
        address account,
        address prevOwner,
        address oldOwner,
        address newOwner,
        uint256 nonce
    ) public view returns (bytes memory) {
        uint256 chainId = getChainId();

        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, chainId, this));

        bytes32 transactionHash = keccak256(
            abi.encode(DELAYED_RECOVERY_TRANSACTION_TYPEHASH, recoverer, manager, account, prevOwner, oldOwner, newOwner, nonce)
        );

        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator, transactionHash);
    }

    function createAnnouncement(
        address manager,
        address account,
        address prevOwner,
        address oldOwner,
        address newOwner,
        uint256 nonce,
        uint64 executionTime
    ) external onlyRecoverer {
        bytes32 txHash = getTransactionHash(manager, account, prevOwner, oldOwner, newOwner, nonce);
        Announcement memory announcement = announcements[txHash];

        if (executionTime <= block.timestamp) {
            revert ExecutiontimeShouldBeInFuture();
        }

        if (announcement.executed) {
            revert TransactionAlreadyExecuted(txHash);
        }

        if (!announcement.executed && announcement.executionTime != 0) {
            revert TransactionAlreadyScheduled(txHash);
        }

        announcements[txHash] = Announcement(executionTime, type(uint16).max, false);
        emit NewRecoveryAnnouncement();
    }

    function cancelAnnouncement(
        address manager,
        address account,
        address prevOwner,
        address oldOwner,
        address newOwner,
        uint256 nonce
    ) external onlyRecoverer {
        bytes32 txHash = getTransactionHash(manager, account, prevOwner, oldOwner, newOwner, nonce);

        Announcement memory announcement = announcements[txHash];
        if (announcement.executed) {
            revert TransactionAlreadyExecuted(txHash);
        }

        if (announcement.executionTime == 0) {
            revert TransactionNotFound(txHash);
        }

        delete announcements[txHash];

        emit RecoveryAccouncementCancelled();
    }

    function getTransactionHash(
        address manager,
        address account,
        address prevOwner,
        address oldOwner,
        address newOwner,
        uint256 nonce
    ) public view returns (bytes32) {
        return keccak256(getTransactionHashData(manager, account, prevOwner, oldOwner, newOwner, nonce));
    }
}
