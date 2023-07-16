import { Interface, ethers } from "ethers"
import protocolDeployments from "@safe-global/safe-core-protocol"
import { getProvider } from "./web3"

const Metadata_PROVIDER_ABI = [
    "function retrieveMetadata(bytes32 metadataHash) external view returns (bytes metadata)"
]

const PLUGIN_ABI = [
    "function metadataHash() public view returns (bytes32 metadataHash)",
    "function metadataProvider() external view returns (uint256 providerType, bytes location)"
]

export const getManager = async() => {
    const provider = await getProvider()
    const registryInfo = {
        address: "0xb4Dc1B282706aB473cdD1b9899c57baD2BD3e2f3",
        abi: protocolDeployments[5][0].contracts.SafeProtocolManager.abi
    };
    return new ethers.Contract(
        registryInfo.address,
        registryInfo.abi,
        provider
    )
}

export const getRegistry = async() => {
    const provider = await getProvider()
    const registryInfo = protocolDeployments[5][0].contracts.TestSafeProtocolRegistryUnrestricted;
    return new ethers.Contract(
        "0x9EFbBcAD12034BC310581B9837D545A951761F5A",
        registryInfo.abi,
        provider
    )
}

export const getPlugin = async(pluginAddress: string) => {
    const provider = await getProvider()
    console.log(new Interface(PLUGIN_ABI))
    return new ethers.Contract(
        pluginAddress,
        PLUGIN_ABI,
        provider
    )
}

export const getMetadataProvider = async(providerAddress: string) => {
    const provider = await getProvider()
    return new ethers.Contract(
        providerAddress,
        Metadata_PROVIDER_ABI,
        provider
    )
}