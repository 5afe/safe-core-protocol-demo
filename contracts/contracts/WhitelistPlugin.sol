// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;
import {ISafe} from "@safe-global/safe-core-protocol/contracts/interfaces/Accounts.sol";
import {ISafeProtocolPlugin} from "@safe-global/safe-core-protocol/contracts/interfaces/Integrations.sol";
import {ISafeProtocolManager} from "@safe-global/safe-core-protocol/contracts/interfaces/Manager.sol";
import {SafeTransaction, SafeRootAccess} from "@safe-global/safe-core-protocol/contracts/DataTypes.sol";
import {BasePluginWithEventMetadata, PluginMetadata} from "./Base.sol";

/**
 * @title WhitelistPlugin maintains a mapping that stores information about accounts that are
 *        permitted to execute non-root transactions through a Safe account.
 * @notice This plugin does not need Safe owner(s) confirmation(s) to execute Safe txs once enabled
 *         through a Safe{Core} Protocol Manager.
 */
contract WhitelistPlugin is BasePluginWithEventMetadata {
    // safe account => account => whitelist status
    mapping(address => mapping(address => bool)) public whitelistedAddresses;

    event AddressWhitelisted(address indexed account);
    event AddressRemovedFromWhitelist(address indexed account);

    error AddressNotWhiteListed(address account);

    constructor()
        BasePluginWithEventMetadata(
            PluginMetadata({name: "Whitelist Plugin", version: "1.0.0", requiresRootAccess: false, iconUrl: "", appUrl: ""})
        )
    {}

    /**
     * @notice Executes a Safe transaction if the caller is whitelisted for the given Safe account.
     * @param manager Address of the Safe{Core} Protocol Manager.
     * @param safe Safe account
     * @param safetx SafeTransaction to be executed
     */
    function executeFromPlugin(
        ISafeProtocolManager manager,
        ISafe safe,
        SafeTransaction calldata safetx
    ) external returns (bytes[] memory data) {
        if (!whitelistedAddresses[address(safe)][msg.sender]) {
            revert AddressNotWhiteListed(msg.sender);
        }
        // Test: Any tx that updates whitelist of this contract should be blocked
        (data) = manager.executeTransaction(safe, safetx);
    }

    /**
     * @notice Removes an account from whitelist mapping.
     *         The caller should be a Safe account.
     * @param account address of the account to be whitelisted
     */
    function addToWhitelist(address account) external {
        whitelistedAddresses[msg.sender][account] = true;
        emit AddressWhitelisted(account);
    }

    /**
     * @notice Removes an account from whitelist mapping.
     *         The caller H be a Safe account.
     * @param account address of the account to be removed from the whitelist
     */
    function removeFromWhitelist(address account) external {
        whitelistedAddresses[msg.sender][account] = false;
        emit AddressRemovedFromWhitelist(account);
    }
}
