import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getProtocolManagerAddress } from "../utils/protocol";
import { getGelatoAddress } from "@gelatonetwork/relay-context";
import { ZeroAddress } from "ethers";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    const manager = await getProtocolManagerAddress(hre)
    console.log({manager})

    // execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)
    // https://www.4byte.directory/signatures/?bytes4_signature=0x6a761202
    const relayMethod = "0x6a761202"
    const trustedOrigin = hre.network.name === "hardhat" ? ZeroAddress : getGelatoAddress(hre.network.name)
    await deploy("SamplePlugin", {
        from: deployer,
        args: [manager, trustedOrigin, relayMethod],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ["plugins"];
export default deploy;