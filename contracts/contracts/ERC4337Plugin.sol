// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;
import {ISafeProtocolPlugin} from "@safe-global/safe-core-protocol/contracts/interfaces/Integrations.sol";

import {SafeTransaction, SafeRootAccess, SafeProtocolAction} from "@safe-global/safe-core-protocol/contracts/DataTypes.sol";
import {BasePluginWithEventMetadata, PluginMetadata} from "./Base.sol";

interface ISafe {
    function isOwner(address owner) external view returns (bool);

    function enableModule(address module) external;

    function setFallbackHandler(address handler) external;

    function execTransactionFromModule(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success);

    function execTransactionFromModuleReturnData(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success, bytes memory returnData);
}

interface ISafeProtocolManager {
    function enablePlugin(address plugin, bool allowRootAccess) external;

    function setFunctionHandler(bytes4 selector, address functionHandler) external;

    /**
     * @notice This function allows enabled plugins to execute non-delegate call transactions thorugh a Safe.
     *         It should validate the status of the plugin through the registry and allows only listed and non-flagged integrations to execute transactions.
     * @param safe Address of a Safe account
     * @param transaction SafeTransaction instance containing payload information about the transaction
     * @return data Array of bytes types returned upon the successful execution of all the actions. The size of the array will be the same as the size of the actions
     *         in case of succcessful execution. Empty if the call failed.
     */
    function executeTransaction(ISafe safe, SafeTransaction calldata transaction) external returns (bytes[] memory data);

    /**
     * @notice This function allows enabled plugins to execute delegate call transactions thorugh a Safe.
     *         It should validate the status of the plugin through the registry and allows only listed and non-flagged integrations to execute transactions.
     * @param safe Address of a Safe account
     * @param rootAccess SafeTransaction instance containing payload information about the transaction
     * @return data Arbitrary length bytes data returned upon the successful execution. The size of the array will be the same as the size of the actions
     *         in case of succcessful execution. Empty if the call failed.
     */
    function executeRootAccess(ISafe safe, SafeRootAccess calldata rootAccess) external returns (bytes memory data);
}

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

/**
 * @title WhitelistPlugin maintains a mapping that stores information about accounts that are
 *        permitted to execute non-root transactions through a Safe account.
 * @notice This plugin does not need Safe owner(s) confirmation(s) to execute Safe txs once enabled
 *         through a Safe{Core} Protocol Manager.
 */
contract ERC4337Plugin is BasePluginWithEventMetadata {
    address public immutable PLUGIN_ADDRESS;
    address public immutable SAFE_PROTOCOL_MANAGER;
    address payable public immutable ENTRY_POINT;

    constructor(
        address safeCoreProtocolManager,
        address payable entryPoint
    )
        BasePluginWithEventMetadata(
            PluginMetadata({name: "ERC4337 Plugin", version: "1.0.0", requiresRootAccess: false, iconUrl: "", appUrl: ""})
        )
    {
        PLUGIN_ADDRESS = address(this);
        SAFE_PROTOCOL_MANAGER = safeCoreProtocolManager;
        ENTRY_POINT = entryPoint;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        address payable safeAddress = payable(userOp.sender);
        ISafe senderSafe = ISafe(safeAddress);

        if (missingAccountFunds != 0) {
            senderSafe.execTransactionFromModule(ENTRY_POINT, missingAccountFunds, "", 0);
        }

        return 0;
    }

    function execTransaction(address payable to, uint256 value, bytes calldata data) external payable onlyEntryPoint {
        address payable safeAddress = payable(msg.sender);
        ISafe safe = ISafe(safeAddress);
        require(safe.execTransactionFromModule(to, value, data, 0), "tx failed");
    }

    function enableSafeCoreProtocolWith4337Plugin() public {
        require(address(this) != PLUGIN_ADDRESS, "Only delegatecall");

        ISafeProtocolManager safeCoreProtocolManager = ISafeProtocolManager(SAFE_PROTOCOL_MANAGER);
        ISafe safe = ISafe(address(this));

        safe.enableModule(SAFE_PROTOCOL_MANAGER);
        safe.setFallbackHandler(SAFE_PROTOCOL_MANAGER);

        safeCoreProtocolManager.enablePlugin(PLUGIN_ADDRESS, false);
        safeCoreProtocolManager.setFunctionHandler(this.validateUserOp.selector, PLUGIN_ADDRESS);
        safeCoreProtocolManager.setFunctionHandler(this.execTransaction.selector, PLUGIN_ADDRESS);
    }

    function requireFromEntryPoint() internal view {
        require(msg.sender == ENTRY_POINT, "Only entry point");
    }

    modifier onlyEntryPoint() {
        requireFromEntryPoint();
        _;
    }
}
