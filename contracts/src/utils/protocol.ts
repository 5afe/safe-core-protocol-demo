import { HardhatRuntimeEnvironment } from "hardhat/types";
import protocolDeployments from "@safe-global/safe-core-protocol"
import { id } from "ethers";

const deployMock = async(hre: HardhatRuntimeEnvironment, name: string): Promise<string> => {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    const result = await deploy("MockContract", {
        from: deployer,
        args: [],
        log: true,
        deterministicDeployment: id(name),
    });
    return result.address
}

export const getProtocolManagerAddress = async(hre: HardhatRuntimeEnvironment): Promise<string> => {
    const chainId = await hre.getChainId()

    // For the tests we deploy a mock for the manager
    if (chainId === "31337") return deployMock(hre, "ManagerMock")
    
    if (!(chainId in protocolDeployments)) throw Error("Unsupported Chain")
    const manager = (protocolDeployments as any)[chainId][0].contracts.SafeProtocolManager.address
    if (typeof manager !== "string") throw Error("Unexpected Manager")
    return manager
}

export const getProtocolRegistryAddress = async(hre: HardhatRuntimeEnvironment): Promise<string> => {
    const chainId = await hre.getChainId()

    // For the tests we deploy a mock for the registry
    if (chainId === "31337") return deployMock(hre, "RegistryMock")
    
    if (!(chainId in protocolDeployments)) throw Error("Unsupported Chain")
    // We use the unrestricted registry for the demo
    const registry = (protocolDeployments as any)[chainId][0].contracts.TestSafeProtocolRegistryUnrestricted.address
    if (typeof registry !== "string") throw Error("Unexpected Registry")
    return registry
}