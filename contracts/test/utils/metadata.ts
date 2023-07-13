import { AbiCoder, isHexString, keccak256 } from "ethers";
import { BasePlugin, MetaDataProvider } from "../../typechain-types";
import { getInstance } from "./contracts";

interface PluginMetaData {
    name: string;
    version: string;
    requiresRootAccess: boolean;
    iconUrl: string;
    appUrl: string;
}

// const ProviderType_IPFS = 0n;
// const ProviderType_URL = 1n;
const ProviderType_Contract = 2n;
// const ProviderType_Event = 3n;

const PluginMetaDataType: string[] = ["string name", "string version", "bool requiresRootAccess", "string iconUrl", "string appUrl"];

const loadPluginMetaDataFromContract = async (provider: string, metaDataHash: string): Promise<string> => {
    const providerInstance = await getInstance<MetaDataProvider>("MetaDataProvider", provider);
    return await providerInstance.retrieveMetaData(metaDataHash);
};

const loadRawMetaData = async (plugin: BasePlugin, metaDataHash: string): Promise<string> => {
    const [type, source] = await plugin.metaProvider();
    switch (type) {
        case ProviderType_Contract:
            return loadPluginMetaDataFromContract(AbiCoder.defaultAbiCoder().decode(["address"], source)[0], metaDataHash);
        default:
            throw Error("Unsupported MetaDataProviderType");
    }
};

export const loadPluginMetaData = async (plugin: BasePlugin): Promise<PluginMetaData> => {
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
