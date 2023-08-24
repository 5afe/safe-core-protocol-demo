// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;
import {ISafe} from "@safe-global/safe-core-protocol/contracts/interfaces/Accounts.sol";
import {ISafeProtocolPlugin} from "@safe-global/safe-core-protocol/contracts/interfaces/Integrations.sol";
import {ISafeProtocolManager} from "@safe-global/safe-core-protocol/contracts/interfaces/Manager.sol";
import {BasePluginWithEventMetadata, PluginMetadata} from "./Base.sol";
import {SafeTransaction, SafeRootAccess, SafeProtocolAction} from "@safe-global/safe-core-protocol/contracts/DataTypes.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RecoveryPlugin - A contract compatible with Safe{Core} Protocol that replaces a specified owner for a Safe by a non-owner account.
 * @notice This contract should be listed in a Registry and enabled as a Plugin for an account through a Manager to be able to intiate recovery mechanism.
 * @author Akshay Patel - @akshay-ap
 */
contract RecoveryPlugin is BasePluginWithEventMetadata, Ownable {
    event OwnerReplaced(address account, address oldowner, address newOwner);

    constructor(
        address initialOwner
    )
        BasePluginWithEventMetadata(
            PluginMetadata({name: "Recovery Plugin", version: "1.0.0", requiresRootAccess: true, iconUrl: "", appUrl: ""})
        )
    {
        _transferOwnership(initialOwner);
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
        address newOwner
    ) external onlyOwner returns (bytes memory data) {
        bytes memory txData = abi.encodeWithSignature("swapOwner(address,address,address)", prevOwner, oldOwner, newOwner);

        SafeProtocolAction memory safeProtocolAction = SafeProtocolAction(payable(address(safe)), 0, txData);
        SafeRootAccess memory safeTx = SafeRootAccess(safeProtocolAction, 0, "");
        (data) = manager.executeRootAccess(safe, safeTx);

        emit OwnerReplaced(address(safe), oldOwner, newOwner);
    }
}
