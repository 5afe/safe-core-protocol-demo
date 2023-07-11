// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;

import {ISafe} from "./interfaces/Accounts.sol";
import {ISafeProtocolPlugin} from "./interfaces/Integrations.sol";
import {ISafeProtocolManager} from "./interfaces/Manager.sol";
import {SafeTransaction, SafeRootAccess} from "./DataTypes.sol";

abstract contract BasePlugin is ISafeProtocolPlugin {
    string public name;
    string public version;
    bool public immutable requiresRootAccess;

    constructor(string memory _name, string memory _version, bool _requiresRootAccess) {
        name = _name;
        version = _version;
        requiresRootAccess = _requiresRootAccess;
    }

    function metaProvider() external view override returns (uint256 providerType, bytes memory location) {}
}

contract SamplePlugin is BasePlugin {

    constructor() BasePlugin("Sample Plugin", "1.0.0", false) {

    }

    function executeFromPlugin(
        ISafeProtocolManager manager,
        ISafe safe,
        SafeTransaction calldata safetx
    ) external returns (bytes[] memory data) {
        (data) = manager.executeTransaction(safe, safetx);
    }
}
