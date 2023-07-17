import { AbiCoder, Interface, isHexString, keccak256 } from "ethers";
import { BasePlugin, IMetadataProvider } from "../../typechain-types";
import { getInstance } from "../utils/contracts";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface PluginMetadata {
    name: string;
    version: string;
    requiresRootAccess: boolean;
    iconUrl: string;
    appUrl: string;
}

// const ProviderType_IPFS = 0n;
// const ProviderType_URL = 1n;
const ProviderType_Contract = 2n;
const ProviderType_Event = BigInt(3);

const MetadataEvent: string[] = ["event Metadata(bytes32 indexed metadataHash, bytes data)"]
const PluginMetadataType: string[] = ["string name", "string version", "bool requiresRootAccess", "string iconUrl", "string appUrl"];

const loadPluginMetadataFromContract = async (hre: HardhatRuntimeEnvironment, provider: string, metadataHash: string): Promise<string> => {
    const providerInstance = await getInstance<IMetadataProvider>(hre, "IMetadataProvider", provider);
    return await providerInstance.retrieveMetadata(metadataHash);
};

const loadPluginMetadataFromEvent = async (hre: HardhatRuntimeEnvironment, provider: string, metadataHash: string): Promise<string> => {
    const eventInterface = new Interface(MetadataEvent)
    const events = await hre.ethers.provider.getLogs({
        address: provider,
        topics: eventInterface.encodeFilterTopics("Metadata", [metadataHash]),
        fromBlock: "earliest",
        toBlock: "latest"
    })
    if (events.length == 0) throw Error("Metadata not found");
    const metadataEvent = events[events.length - 1];
    const decodedEvent = eventInterface.decodeEventLog("Metadata", metadataEvent.data, metadataEvent.topics)
    return decodedEvent.data;
};

const loadRawMetadata = async (hre: HardhatRuntimeEnvironment, plugin: BasePlugin, metadataHash: string): Promise<string> => {
    const [type, source] = await plugin.metadataProvider();
    switch (type) {
        case ProviderType_Contract:
            return loadPluginMetadataFromContract(hre, AbiCoder.defaultAbiCoder().decode(["address"], source)[0], metadataHash);
        case ProviderType_Event:
            return loadPluginMetadataFromEvent(hre, AbiCoder.defaultAbiCoder().decode(["address"], source)[0], metadataHash);
        default:
            throw Error("Unsupported MetadataProviderType");
    }
};

export const loadPluginMetadata = async (hre: HardhatRuntimeEnvironment, plugin: BasePlugin): Promise<PluginMetadata> => {
    const metadataHash = await plugin.metadataHash();
    const metadata = await loadRawMetadata(hre, plugin, metadataHash);
    if (metadataHash !== keccak256(metadata)) throw Error("Invalid metadata retrieved!");
    return decodePluginMetadata(metadata);
};

export const decodePluginMetadata = (data: string): PluginMetadata => {
    if (!isHexString(data)) throw Error("Invalid data format");
    const format = data.slice(2, 6);
    if (format !== "0000") throw Error("Unsupported format or format version");
    const metadata = data.slice(6);
    const decoded = AbiCoder.defaultAbiCoder().decode(PluginMetadataType, "0x" + metadata);
    return {
        name: decoded[0],
        version: decoded[1],
        requiresRootAccess: decoded[2],
        iconUrl: decoded[3],
        appUrl: decoded[4],
    };
};
