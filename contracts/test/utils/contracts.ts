import { BaseContract } from "ethers";
import hre, { deployments } from "hardhat";
import { SamplePlugin } from "../../typechain-types";

export const getInstance = async <T extends BaseContract>(name: string, address: string): Promise<T> => {
    // TODO: this typecasting should be refactored
    return (await hre.ethers.getContractAt(name, address)) as unknown as T;
};

export const getSingleton = async <T extends BaseContract>(name: string): Promise<T> => {
    const deployment = await deployments.get(name);
    return getInstance<T>(name, deployment.address);
};

export const getSamplePlugin = () => getSingleton<SamplePlugin>("SamplePlugin");
