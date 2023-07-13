import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getProtocolManagerAddress } from "../utils/protocol";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    const manager = await getProtocolManagerAddress(hre)
    console.log({manager})

    await deploy("SamplePlugin", {
        from: deployer,
        args: [manager],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ["plugins"];
export default deploy;