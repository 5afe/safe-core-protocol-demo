// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;

import {ISafe} from "./interfaces/Accounts.sol";
import {ISafeProtocolPlugin} from "./interfaces/Integrations.sol";
import {ISafeProtocolManager} from "./interfaces/Manager.sol";
import {SafeTransaction, SafeRootAccess} from "./DataTypes.sol";

enum MetaDataProviderType {
    IPFS,
    URL,
    Contract,
    Event
}

interface MetaDataProvider {
    function retrieveMetaData(bytes32 metaDataHash) external view returns (bytes memory metaData);
}

struct PluginMetaData {
    string name;
    string version;
    bool requiresRootAccess;
    string iconUrl;
    string appUrl;
}

library PluginMetaDataOps {
    function encode(PluginMetaData memory data) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                uint8(0x00), // Format
                uint8(0x00), // Format version
                abi.encode(data.name, data.version, data.requiresRootAccess, data.iconUrl, data.appUrl) // Meta Data
            );
    }

    function decode(bytes calldata data) internal pure returns (PluginMetaData memory) {
        require(bytes16(data[0:2]) == bytes16(0x0000), "Unsupported format or format version");
        (string memory name, string memory version, bool requiresRootAccess, string memory iconUrl, string memory appUrl) = abi.decode(
            data[2:],
            (string, string, bool, string, string)
        );
        return PluginMetaData(name, version, requiresRootAccess, iconUrl, appUrl);
    }
}

abstract contract BasePlugin is ISafeProtocolPlugin, MetaDataProvider {
    using PluginMetaDataOps for PluginMetaData;

    string public name;
    string public version;
    bool public immutable requiresRootAccess;
    bytes32 public immutable metaDataHash;
    bytes private encodedMetaData;

    constructor(PluginMetaData memory metaData) {
        name = metaData.name;
        version = metaData.version;
        requiresRootAccess = metaData.requiresRootAccess;
        // MetaData Format + Format Version + Encoded MetaData
        encodedMetaData = metaData.encode();
        metaDataHash = keccak256(encodedMetaData);
    }

    function metaProvider() external view override returns (uint256 providerType, bytes memory location) {
        providerType = uint256(MetaDataProviderType.Contract);
        location = abi.encode(address(this));
    }

    function retrieveMetaData(bytes32 _metaDataHash) external view returns (bytes memory metaData) {
        require(metaDataHash == _metaDataHash, "Cannot retrieve meta data");
        return encodedMetaData;
    }
}

contract SamplePlugin is BasePlugin {
    constructor()
        BasePlugin(PluginMetaData({name: "Sample Plugin", version: "1.0.0", requiresRootAccess: false, iconUrl: "", appUrl: ""}))
    {}

    function executeFromPlugin(
        ISafeProtocolManager manager,
        ISafe safe,
        SafeTransaction calldata safetx
    ) external returns (bytes[] memory data) {
        (data) = manager.executeTransaction(safe, safetx);
    }
}
