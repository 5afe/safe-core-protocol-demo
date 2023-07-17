import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getGelatoAddress } from "@gelatonetwork/relay-context";
import { ZeroAddress } from "ethers";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    // execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)
    // https://www.4byte.directory/signatures/?bytes4_signature=0x6a761202
    const relayMethod = "0x6a761202"
    // We don't use a trusted origin right now to make it easier to test.
    // For production networks it is strongly recommended to set one to avoid potential fee extraction.
    const trustedOrigin = ZeroAddress // hre.network.name === "hardhat" ? ZeroAddress : getGelatoAddress(hre.network.name)
    await deploy("RelayPlugin", {
        from: deployer,
        args: [trustedOrigin, relayMethod],
        log: true,
        deterministicDeployment: true,
    });
};

deploy.tags = ["plugins"];
export default deploy;