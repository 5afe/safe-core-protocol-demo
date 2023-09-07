import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { loadPluginMetadata } from "../src/utils/metadata";
import { getProtocolManagerAddress } from "../src/utils/protocol";
import { deploySafe, getSafeProxyFactoryContractFactory, getSafeSingletonContractFactory } from "./utils/safe";
import { IntegrationType } from "../src/utils/constants";

const ERC4337_TEST_ENV_VARIABLES_DEFINED =
    typeof process.env.ERC4337_TEST_BUNDLER_URL !== "undefined" &&
    typeof process.env.ERC4337_TEST_NODE_URL !== "undefined" &&
    typeof process.env.ERC4337_TEST_SAFE_FACTORY_ADDRESS !== "undefined" &&
    typeof process.env.ERC4337_TEST_SINGLETON_ADDRESS !== "undefined" &&
    typeof process.env.ERC4337_TEST_MNEMONIC !== "undefined";

const itif = ERC4337_TEST_ENV_VARIABLES_DEFINED ? it : it.skip;
const SAFE_FACTORY_ADDRESS = process.env.ERC4337_TEST_SAFE_FACTORY_ADDRESS;
const SINGLETON_ADDRESS = process.env.ERC4337_TEST_SINGLETON_ADDRESS;
const BUNDLER_URL = process.env.ERC4337_TEST_BUNDLER_URL;
const NODE_URL = process.env.ERC4337_TEST_NODE_URL;
const MNEMONIC = process.env.ERC4337_TEST_MNEMONIC;

const randomAddress = "0x1234567890123456789012345678901234567890";

describe("ERC4337 Plugin", () => {
    const setup = deployments.createFixture(async ({ deployments }) => {
        const signers = await hre.ethers.getSigners();
        await deployments.fixture();
        const manager = await ethers.getContractAt("MockContract", await getProtocolManagerAddress(hre));

        const testRegistryFactory = await ethers.getContractFactory("TestSafeProtocolRegistryUnrestricted");
        const testRegistryDeployment = await testRegistryFactory.deploy(signers[0].address);
        const safeProtocolManager = await (
            await ethers.getContractFactory("SafeProtocolManager")
        ).deploy(signers[0].address, testRegistryDeployment.getAddress());
        const erc4337Plugin = await (
            await ethers.getContractFactory("ERC4337Plugin")
        ).deploy(safeProtocolManager.getAddress(), randomAddress);
        await testRegistryDeployment.addModule(erc4337Plugin.getAddress(), IntegrationType.Plugin);
        await testRegistryDeployment.addModule(erc4337Plugin.getAddress(), IntegrationType.FunctionHandler);

        const account = await (await ethers.getContractFactory("ExecutableMockContract")).deploy();
        const proxyFactory = await (await (await getSafeProxyFactoryContractFactory()).deploy()).waitForDeployment();
        const safeSingleton = await (await (await getSafeSingletonContractFactory()).deploy()).waitForDeployment();

        const callData = erc4337Plugin.interface.encodeFunctionData("enableSafeCoreProtocolWith4337Plugin");
        const safe = await deploySafe(proxyFactory, safeSingleton, [signers[0].address], 1, await erc4337Plugin.getAddress(), callData);

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
        expect(await erc4337Plugin.permissions()).to.be.eq(1);
    });

    it("can retrieve meta data for module", async () => {
        const { erc4337Plugin } = await setup();
        expect(await loadPluginMetadata(hre, erc4337Plugin)).to.be.deep.eq({
            name: "ERC4337 Plugin",
            version: "1.0.0",
            permissions: 1,
            iconUrl: "",
            appUrl: "",
        });
    });

    it("can deploy a safe with manager and ERC4337 module", async () => {
        const { erc4337Plugin, manager, signers, safe } = await setup();
    });

    /**
     * This test verifies the ERC4337 based on gas estimation for a user operation
     * The user operation deploys a Safe with the ERC4337 module and a handler
     * and executes a transaction, thus verifying two things:
     * 1. Deployment of the Safe with the ERC4337 module and handler is possible
     * 2. Executing a transaction is possible
     */
    itif("integration test", async () => { });
});
