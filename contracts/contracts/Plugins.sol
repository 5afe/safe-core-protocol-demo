// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;

import {ISafe} from "@safe-global/safe-core-protocol/contracts/interfaces/Accounts.sol";
import {ISafeProtocolPlugin} from "@safe-global/safe-core-protocol/contracts/interfaces/Integrations.sol";
import {ISafeProtocolManager} from "@safe-global/safe-core-protocol/contracts/interfaces/Manager.sol";
import {SafeTransaction, SafeRootAccess} from "@safe-global/safe-core-protocol/contracts/DataTypes.sol";

enum MetadataProviderType {
    IPFS,
    URL,
    Contract,
    Event
}

interface MetadataProvider {
    function retrieveMetadata(bytes32 metadataHash) external view returns (bytes memory metadata);
}

struct PluginMetadata {
    string name;
    string version;
    bool requiresRootAccess;
    string iconUrl;
    string appUrl;
}

library PluginMetadataOps {
    function encode(PluginMetadata memory data) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                uint8(0x00), // Format
                uint8(0x00), // Format version
                abi.encode(data.name, data.version, data.requiresRootAccess, data.iconUrl, data.appUrl) // Plugin Metadata
            );
    }

    function decode(bytes calldata data) internal pure returns (PluginMetadata memory) {
        require(bytes16(data[0:2]) == bytes16(0x0000), "Unsupported format or format version");
        (string memory name, string memory version, bool requiresRootAccess, string memory iconUrl, string memory appUrl) = abi.decode(
            data[2:],
            (string, string, bool, string, string)
        );
        return PluginMetadata(name, version, requiresRootAccess, iconUrl, appUrl);
    }
}

abstract contract BasePlugin is ISafeProtocolPlugin, MetadataProvider {
    using PluginMetadataOps for PluginMetadata;

    string public name;
    string public version;
    bool public immutable requiresRootAccess;
    bytes32 public immutable metadataHash;
    bytes private encodedMetadata;

    constructor(PluginMetadata memory metadata) {
        name = metadata.name;
        version = metadata.version;
        requiresRootAccess = metadata.requiresRootAccess;
        // Metadata Format + Format Version + Encoded Metadata
        encodedMetadata = metadata.encode();
        metadataHash = keccak256(encodedMetadata);
    }

    // TODO: Legacy version that should be removed
    function metaProvider() external view override returns (uint256 providerType, bytes memory location) {
        return metadataProvider();
    }

    function metadataProvider() public view returns (uint256 providerType, bytes memory location) {
        providerType = uint256(MetadataProviderType.Contract);
        location = abi.encode(address(this));
    }

    function retrieveMetadata(bytes32 _metadataHash) external view returns (bytes memory metadata) {
        require(metadataHash == _metadataHash, "Cannot retrieve metadata");
        return encodedMetadata;
    }
}

contract SamplePlugin is BasePlugin {
    ISafeProtocolManager public immutable manager;

    constructor(
        ISafeProtocolManager _manager
    ) BasePlugin(PluginMetadata({name: "Sample Plugin", version: "1.0.0", requiresRootAccess: false, iconUrl: "", appUrl: ""})) {
        manager = _manager;
    }

    function executeFromPlugin(ISafe safe, SafeTransaction calldata safetx) external returns (bytes[] memory data) {
        (data) = manager.executeTransaction(safe, safetx);
    }
}
