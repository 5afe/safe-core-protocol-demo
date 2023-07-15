import { AbiCoder, Contract, Interface, isHexString, keccak256, getAddress } from "ethers";
import { getMetadataProvider } from "./protocol";
import { getProvider } from "./web3";

export interface PluginMetadata {
    name: string;
    version: string;
    requiresRootAccess: boolean;
    iconUrl: string;
    appUrl: string;
}

// const ProviderType_IPFS = BigInt(0);
// const ProviderType_URL = BigInt(1);
const ProviderType_Contract = BigInt(2);
const ProviderType_Event = BigInt(3);

const MetadataEvent: string[] = ["event Metadata(bytes32 indexed metadataHash, bytes data)"]
const PluginMetadataType: string[] = ["string name", "string version", "bool requiresRootAccess", "string iconUrl", "string appUrl"];

const loadPluginMetadataFromContract = async (provider: string, metadataHash: string): Promise<string> => {
    const providerInstance = await getMetadataProvider(provider);
    return await providerInstance.retrieveMetadata(metadataHash);
};

const loadPluginMetadataFromEvent = async (provider: string, metadataHash: string): Promise<string> => {
    const web3Provider = await getProvider()
    const eventInterface = new Interface(MetadataEvent)
    const events = await web3Provider.getLogs({
        fromBlock: "earliest",
        toBlock: "latest",
        address: provider,
        topics: eventInterface.encodeFilterTopics("Metadata", [metadataHash])
    })
    if (events.length == 0) throw Error("Metadata not found");
    const metadataEvent = events[events.length - 1];
    const decodedEvent = eventInterface.decodeEventLog("Metadata", metadataEvent.data, metadataEvent.topics)
    return decodedEvent.data;
};


const loadRawMetadata = async (plugin: Contract, metadataHash: string): Promise<string> => {
    const [type, source] = await plugin.metadataProvider();
    switch (type) {
        case ProviderType_Contract:
            return loadPluginMetadataFromContract(AbiCoder.defaultAbiCoder().decode(["address"], source)[0], metadataHash);
        case ProviderType_Event:
            return loadPluginMetadataFromEvent(AbiCoder.defaultAbiCoder().decode(["address"], source)[0], metadataHash);
        default:
            throw Error("Unsupported MetadataProviderType");
    }
};

const parseAppUrl = (rawUrl: string, pluginAddress: string | undefined) => {
    // Check if URL contain template for plugin address
    let parsedUrl = rawUrl;
    if (rawUrl.indexOf("${plugin}") >= 0) {
        // This will throw if no address is provided, but that is ok for now
        const address = getAddress(pluginAddress!!)
        parsedUrl = parsedUrl.replaceAll("${plugin}", address)
    }
    return parsedUrl
}

export const decodePluginMetadata = (data: string, pluginAddress?: string): PluginMetadata => {
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
        appUrl: parseAppUrl(decoded[4], pluginAddress),
    };
};

export const loadPluginMetadata = async (plugin: Contract): Promise<PluginMetadata> => {
    console.log({plugin})
    const metadataHash = await plugin.metadataHash();
    const metadata = await loadRawMetadata(plugin, metadataHash);
    if (metadataHash !== keccak256(metadata)) throw Error("Invalid metadata retrieved!");
    return decodePluginMetadata(metadata, await plugin.getAddress());
};
