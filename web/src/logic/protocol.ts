import { Interface, ethers } from "ethers"
import protocolDeployments from "@safe-global/safe-core-protocol"
import { getProvider } from "./web3"

const METADATA_PROVIDER_ABI = [
    "function retrieveMetaData(bytes32 metaDataHash) external view returns (bytes metaData)"
]

const PLUGIN_ABI = [
    "function metaDataHash() public view returns (bytes32 metaDataHash)",
    "function metaProvider() external view returns (uint256 providerType, bytes location)"
]

export const getRegistry = () => {
    const provider = getProvider()
    const registryInfo = protocolDeployments[5][0].contracts.TestSafeProtocolRegistryUnrestricted;
    return new ethers.Contract(
        registryInfo.address,
        registryInfo.abi,
        provider
    )
}

export const getPlugin = (pluginAddress: string) => {
    const provider = getProvider()
    console.log(new Interface(PLUGIN_ABI))
    return new ethers.Contract(
        pluginAddress,
        PLUGIN_ABI,
        provider
    )
}

export const getMetadataProvider = (providerAddress: string) => {
    const provider = getProvider()
    return new ethers.Contract(
        providerAddress,
        METADATA_PROVIDER_ABI,
        provider
    )
}