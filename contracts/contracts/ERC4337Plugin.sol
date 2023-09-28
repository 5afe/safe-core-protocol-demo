// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;
import {ISafeProtocolPlugin, ISafeProtocolFunctionHandler} from "@safe-global/safe-core-protocol/contracts/interfaces/Modules.sol";

import {ISafeProtocolManager} from "@safe-global/safe-core-protocol/contracts/interfaces/Manager.sol";
import {SafeTransaction, SafeRootAccess, SafeProtocolAction} from "@safe-global/safe-core-protocol/contracts/DataTypes.sol";
import {MODULE_TYPE_PLUGIN} from "@safe-global/safe-core-protocol/contracts/common/Constants.sol";
import {BasePlugin, BasePluginWithEventMetadata, PluginMetadata, MetadataProviderType} from "./Base.sol";

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

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

    function enablePlugin(address plugin, uint8 permissions) external;

    function setFunctionHandler(bytes4 selector, address functionHandler) external;
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
contract ERC4337Plugin is ISafeProtocolFunctionHandler, BasePluginWithEventMetadata {
    address public immutable PLUGIN_ADDRESS;
    ISafeProtocolManager public immutable SAFE_PROTOCOL_MANAGER;
    address payable public immutable ENTRY_POINT;

    constructor(
        ISafeProtocolManager safeCoreProtocolManager,
        address payable entryPoint
    ) BasePluginWithEventMetadata(PluginMetadata({name: "ERC4337 Plugin", version: "1.0.0", permissions: 1, iconUrl: "", appUrl: ""})) {
        PLUGIN_ADDRESS = address(this);
        SAFE_PROTOCOL_MANAGER = safeCoreProtocolManager;
        ENTRY_POINT = entryPoint;
    }

    function validateUserOp(UserOperation calldata userOp, bytes32, uint256 missingAccountFunds) external returns (uint256 validationData) {
        require(msg.sender == address(PLUGIN_ADDRESS));
        address payable safeAddress = payable(userOp.sender);
        ISafe senderSafe = ISafe(safeAddress);

        if (missingAccountFunds != 0) {
            senderSafe.execTransactionFromModule(ENTRY_POINT, missingAccountFunds, "", 0);
        }

        return 0;
    }

    function execTransaction(address payable to, uint256 value, bytes calldata data) external {
        require(msg.sender == address(PLUGIN_ADDRESS));
        address payable safeAddress = payable(msg.sender);
        ISafe safe = ISafe(safeAddress);

        require(safe.execTransactionFromModule(to, value, data, 0), "tx failed");
    }

    function handle(address safe, address sender, uint256 value, bytes calldata data) external returns (bytes memory result) {
        bytes4 selector = bytes4(data[0:4]);

        if (selector == this.validateUserOp.selector) {
            (, result) = PLUGIN_ADDRESS.call(data);
        } else if (selector == this.execTransaction.selector) {
            (, result) = PLUGIN_ADDRESS.call(data);
        }
    }

    function enableSafeCoreProtocolWith4337Plugin() public {
        require(address(this) != PLUGIN_ADDRESS, "Only delegatecall");

        ISafe safe = ISafe(address(this));
        safe.setFallbackHandler(address(SAFE_PROTOCOL_MANAGER));
        safe.enableModule(address(SAFE_PROTOCOL_MANAGER));
        safe.enablePlugin(PLUGIN_ADDRESS, MODULE_TYPE_PLUGIN);
        safe.setFunctionHandler(this.validateUserOp.selector, PLUGIN_ADDRESS);
        safe.setFunctionHandler(this.execTransaction.selector, PLUGIN_ADDRESS);
    }

    function requireFromEntryPoint(address sender) internal view {
        require(sender == ENTRY_POINT, "Only entry point");
    }

    function metadataProvider()
        public
        view
        override(BasePluginWithEventMetadata, ISafeProtocolFunctionHandler)
        returns (uint256 providerType, bytes memory location)
    {
        providerType = uint256(MetadataProviderType.Event);
        location = abi.encode(address(this));
    }

    function supportsInterface(bytes4 interfaceId) external pure override(BasePlugin, IERC165) returns (bool) {
        return
            interfaceId == type(ISafeProtocolPlugin).interfaceId ||
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(ISafeProtocolFunctionHandler).interfaceId;
    }
}
