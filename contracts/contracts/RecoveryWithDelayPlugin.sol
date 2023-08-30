// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;
import {ISafe} from "@safe-global/safe-core-protocol/contracts/interfaces/Accounts.sol";
import {ISafeProtocolPlugin} from "@safe-global/safe-core-protocol/contracts/interfaces/Integrations.sol";
import {ISafeProtocolManager} from "@safe-global/safe-core-protocol/contracts/interfaces/Manager.sol";
import {BasePluginWithEventMetadata, PluginMetadata} from "./Base.sol";
import {SafeTransaction, SafeRootAccess, SafeProtocolAction} from "@safe-global/safe-core-protocol/contracts/DataTypes.sol";

/**
 * @title RecoveryWithDelayPlugin - A contract compatible with Safe{Core} Protocol that replaces a specified owner for a Safe by a non-owner account.
 * @notice This contract should be listed in a Registry and enabled as a Plugin for an account through a Manager to be able to intiate recovery mechanism.
 * @dev The recovery process is initiated by a recoverer account. The recoverer account is set during the contract deployment in the constructor and cannot be updated.
 *      The recoverer account can initiate the recovery process by calling the createAnnouncement function and later when the delay is over, any account can execute
 *      complete the recovery process by calling the executeFromPlugin function.
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
        uint64 validityDuration; // Duration in seconds the announcement is valid after delay is over (0 is valid forever)
        bool executed; // Flag if the announced transaction was executed
    }

    // Only recoverer can initiate recovery process
    address public immutable recoverer;

    // Contract storage
    // Transaction Hash -> Announcement
    mapping(bytes32 => Announcement) public announcements;

    // Events
    event NewRecoveryAnnouncement(address indexed account, bytes32 txHash);
    event RecoveryAnnouncementCancelled(address indexed account, bytes32 txHash);
    event OwnerReplaced(address indexed account, address oldowner, address newOwner);

    // Errors
    error CallerNotValidRecoverer();
    error TransactionAlreadyExecuted(bytes32 txHash);
    error TransactionAlreadyScheduled(bytes32 txHash);
    error ExecutionTimeShouldBeInFuture();
    error TransactionNotFound(bytes32 txHash);
    error TransactionExecutionNotAllowedYet(bytes32 txHash);
    error TransactionExecutionValidityExpired(bytes32 txHash);

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
     * @notice Executes a Safe transaction that swaps owner with a new owner. This allows a Safe account to be recovered
     *         if the owner's private key is lost. A safe account must set manager as a Module on a safe and enable this
     *         contract as Plugin on a Safe.
     * @param manager Address of the Safe{Core} Protocol Manager.
     * @param safe Safe account whose owner has to be recovered
     * @param prevOwner Owner that pointed to the owner to be replaced in the linked list
     * @param oldOwner Owner address to be replaced.
     * @param newOwner New owner address.
     * @param nonce A unique identifier used to uniquely identify a recovery transaction.
     * @return data Bytes returned from the manager contract.
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
        Announcement memory announcement = announcements[txHash];

        if (announcement.executed) {
            revert TransactionAlreadyExecuted(txHash);
        }

        if (block.timestamp < uint256(announcement.executionTime)) {
            revert TransactionExecutionNotAllowedYet(txHash);
        }

        if (
            announcement.validityDuration != 0 &&
            block.timestamp > uint256(announcement.executionTime) + uint256(announcement.validityDuration)
        ) {
            revert TransactionExecutionValidityExpired(txHash);
        }

        announcements[txHash].executed = true;

        bytes memory txData = abi.encodeWithSignature("swapOwner(address,address,address)", prevOwner, oldOwner, newOwner);

        SafeProtocolAction memory safeProtocolAction = SafeProtocolAction(payable(address(safe)), 0, txData);
        SafeRootAccess memory safeTx = SafeRootAccess(safeProtocolAction, 0, "");
        (data) = manager.executeRootAccess(safe, safeTx);

        emit OwnerReplaced(address(safe), oldOwner, newOwner);
    }

    /**
     * @notice Creates a recovery announcement for a Safe account. Only the recoverer can create a recovery announcement.
     * @param manager Address of the manager contract.
     * @param account Address of the safe account.
     * @param prevOwner Address of the owner previous to the owner to be replaced in the linked list
     * @param oldOwner Address of the owner to be replaced.
     * @param newOwner Address of the new owner.
     * @param nonce A uint256 used to uniquely identify a recovery transaction.
     * @param executionTime A uint64 representing the block time in seconds after which the announced transaction can be executed.
     */
    function createAnnouncement(
        address manager,
        address account,
        address prevOwner,
        address oldOwner,
        address newOwner,
        uint256 nonce,
        uint64 executionTime,
        uint64 validityDuration
    ) external onlyRecoverer {
        bytes32 txHash = getTransactionHash(manager, account, prevOwner, oldOwner, newOwner, nonce);
        Announcement memory announcement = announcements[txHash];

        if (executionTime <= block.timestamp) {
            revert ExecutionTimeShouldBeInFuture();
        }

        if (announcement.executionTime != 0) {
            revert TransactionAlreadyScheduled(txHash);
        }

        announcements[txHash] = Announcement(executionTime, validityDuration, false);
        emit NewRecoveryAnnouncement(account, txHash);
    }

    /**
     * @notice Cancels a recovery announcement for a Safe account. Only the recoverer can execute this function.
     * @param manager Address of the manager contract.
     * @param account Address of the safe account.
     * @param prevOwner Address of the owner previous to the owner to be replaced in the linked list
     * @param oldOwner Address of the owner to be replaced.
     * @param newOwner Address of the new owner.
     * @param nonce A uint256 used to uniquely identify a recovery transaction.
     */
    function cancelAnnouncement(
        address manager,
        address account,
        address prevOwner,
        address oldOwner,
        address newOwner,
        uint256 nonce
    ) external onlyRecoverer {
        _cancelAnnouncement(manager, account, prevOwner, oldOwner, newOwner, nonce);
    }

    /**
     * @notice Cancels a recovery announcement for a Safe account. This function facilitates cancelling the reccovery process by an account.
     *         The msg.sender should be an account.
     * @param manager Address of the manager contract.
     * @param prevOwner Address of the owner previous to the owner to be replaced in the linked list
     * @param oldOwner Address of the owner to be replaced.
     * @param newOwner Address of the new owner.
     * @param nonce A uint256 used to uniquely identify a recovery transaction.
     */
    function cancelAnnouncementFromAccount(address manager, address prevOwner, address oldOwner, address newOwner, uint256 nonce) external {
        _cancelAnnouncement(manager, msg.sender, prevOwner, oldOwner, newOwner, nonce);
    }

    /**
     * @notice Cancels a recovery announcement for a Safe account. This is a private function that is called by a recoverer or an account.
     * @param manager Address of the manager contract.
     * @param account Address of the safe account.
     * @param prevOwner Address of the owner previous to the owner to be replaced in the linked list
     * @param oldOwner Address of the owner to be replaced.
     * @param newOwner Address of the new owner.
     * @param nonce A uint256 used to uniquely identify a recovery transaction.
     */
    function _cancelAnnouncement(
        address manager,
        address account,
        address prevOwner,
        address oldOwner,
        address newOwner,
        uint256 nonce
    ) private {
        bytes32 txHash = getTransactionHash(manager, account, prevOwner, oldOwner, newOwner, nonce);

        Announcement memory announcement = announcements[txHash];
        if (announcement.executed) {
            revert TransactionAlreadyExecuted(txHash);
        }

        if (announcement.executionTime == 0) {
            revert TransactionNotFound(txHash);
        }

        delete announcements[txHash];

        emit RecoveryAnnouncementCancelled(account, txHash);
    }

    /**
     * @notice Returns the transaction hash for a recovery transaction.
     * @param manager Address of the manager contract.
     * @param account Address of the safe account.
     * @param prevOwner Address of the owner previous to the owner to be replaced in the linked list
     * @param oldOwner Address of the owner to be replaced.
     * @param newOwner Address of the new owner.
     * @param nonce A uint256 used to uniquely identify a recovery transaction.
     */
    function getTransactionHashData(
        address manager,
        address account,
        address prevOwner,
        address oldOwner,
        address newOwner,
        uint256 nonce
    ) public view returns (bytes memory) {
        uint256 chainId = block.chainid;

        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, chainId, this));

        bytes32 transactionHash = keccak256(
            abi.encode(DELAYED_RECOVERY_TRANSACTION_TYPEHASH, recoverer, manager, account, prevOwner, oldOwner, newOwner, nonce)
        );

        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator, transactionHash);
    }

    /**
     * @notice Returns the transaction hash for a recovery transaction. The hash is generated using keccak256 function.
     * @param manager Address of the manager contract.
     * @param account Address of the safe account.
     * @param prevOwner Address of the owner previous to the owner to be replaced in the linked list
     * @param oldOwner Address of the owner to be replaced.
     * @param newOwner Address of the new owner.
     * @param nonce A uint256 used to uniquely identify a recovery transaction.
     */
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
