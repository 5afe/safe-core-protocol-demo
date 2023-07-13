import { AbiCoder, Contract, isHexString, keccak256 } from "ethers";
import { getMetadataProvider } from "./protocol";

export interface PluginMetaData {
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

const PluginMetaDataType: string[] = ["string name", "string version", "bool requiresRootAccess", "string iconUrl", "string appUrl"];

const loadPluginMetaDataFromContract = async (provider: string, metaDataHash: string): Promise<string> => {
    const providerInstance = getMetadataProvider(provider);
    return await providerInstance.retrieveMetaData(metaDataHash);
};

const loadRawMetaData = async (plugin: Contract, metaDataHash: string): Promise<string> => {
    const [type, source] = await plugin.metaProvider();
    console.log(typeof type)
    switch (type) {
        case ProviderType_Contract:
            return loadPluginMetaDataFromContract(AbiCoder.defaultAbiCoder().decode(["address"], source)[0], metaDataHash);
        default:
            throw Error("Unsupported MetaDataProviderType");
    }
};

export const loadPluginMetaData = async (plugin: Contract): Promise<PluginMetaData> => {
    console.log({plugin})
    const metaDataHash = await plugin.metaDataHash();
    const metaData = await loadRawMetaData(plugin, metaDataHash);
    if (metaDataHash !== keccak256(metaData)) throw Error("Invalid meta data retrieved!");
    return decodePluginMetaData(metaData);
};

export const decodePluginMetaData = (data: string): PluginMetaData => {
    if (!isHexString(data)) throw Error("Invalid data format");
    const format = data.slice(2, 6);
    if (format !== "0000") throw Error("Unsupported format or format version");
    const metaData = data.slice(6);
    const decoded = AbiCoder.defaultAbiCoder().decode(PluginMetaDataType, "0x" + metaData);
    return {
        name: decoded[0],
        version: decoded[1],
        requiresRootAccess: decoded[2],
        iconUrl: decoded[3],
        appUrl: decoded[4],
    };
};
