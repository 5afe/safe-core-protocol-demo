import { AbiCoder, Contract, isHexString, keccak256 } from "ethers";
import { getMetadataProvider } from "./protocol";

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
// const ProviderType_Event = BigInt(3);

const PluginMetadataType: string[] = ["string name", "string version", "bool requiresRootAccess", "string iconUrl", "string appUrl"];

const loadPluginMetadataFromContract = async (provider: string, MetadataHash: string): Promise<string> => {
    const providerInstance = getMetadataProvider(provider);
    return await providerInstance.retrieveMetadata(MetadataHash);
};

const loadRawMetadata = async (plugin: Contract, MetadataHash: string): Promise<string> => {
    const [type, source] = await plugin.metadataProvider();
    console.log(typeof type)
    switch (type) {
        case ProviderType_Contract:
            return loadPluginMetadataFromContract(AbiCoder.defaultAbiCoder().decode(["address"], source)[0], MetadataHash);
        default:
            throw Error("Unsupported MetadataProviderType");
    }
};

export const loadPluginMetadata = async (plugin: Contract): Promise<PluginMetadata> => {
    console.log({plugin})
    const metadataHash = await plugin.MetadataHash();
    const metadata = await loadRawMetadata(plugin, metadataHash);
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
