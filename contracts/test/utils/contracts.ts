import { BaseContract } from "ethers";
import hre, { deployments } from "hardhat";
import { SamplePlugin } from "../../typechain-types";

export const getInstance = async<T extends BaseContract>(name: string): Promise<T> => {
    const deployment = await deployments.get(name);
    const Contract = await hre.ethers.getContractFactory(name);
    return Contract.attach(deployment.address) as T;
};

export const getSamplePlugin = () => getInstance<SamplePlugin>("SamplePlugin")