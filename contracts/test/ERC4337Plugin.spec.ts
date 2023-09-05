import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { loadPluginMetadata } from "../src/utils/metadata";
import { getProtocolManagerAddress } from "../src/utils/protocol";
import { deploySafe, getSafeProxyFactoryContractFactory, getSafeSingletonContractFactory } from "./utils/safe";

describe("ERC4337 Plugin", () => {
    const setup = deployments.createFixture(async ({ deployments }) => {
        const signers = await hre.ethers.getSigners();
        await deployments.fixture();
        const manager = await ethers.getContractAt("MockContract", await getProtocolManagerAddress(hre));

        const account = await (await ethers.getContractFactory("ExecutableMockContract")).deploy();
        const erc4337Plugin = await (await hre.ethers.getContractFactory("ERC4337Plugin")).deploy();
        const proxyFactory = await (await (await getSafeProxyFactoryContractFactory()).deploy()).waitForDeployment();
        const safeSingleton = await (await (await getSafeSingletonContractFactory()).deploy()).waitForDeployment();

        const safe = await deploySafe(proxyFactory, safeSingleton, [signers[0].address]);

        return {
            account,
            erc4337Plugin,
            manager,
            signers,
            safe,
        };
    });

    it("should be initialized correctly", async () => {
        const { erc4337Plugin } = await setup();
        expect(await erc4337Plugin.name()).to.be.eq("ERC4337 Plugin");
        expect(await erc4337Plugin.version()).to.be.eq("1.0.0");
        expect(await erc4337Plugin.requiresRootAccess()).to.be.false;
    });

    it("can retrieve meta data for module", async () => {
        const { erc4337Plugin } = await setup();
        expect(await loadPluginMetadata(hre, erc4337Plugin)).to.be.deep.eq({
            name: "ERC4337 Plugin",
            version: "1.0.0",
            requiresRootAccess: false,
            iconUrl: "",
            appUrl: "",
        });
    });
});
