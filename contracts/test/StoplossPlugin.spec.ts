import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getStopLossPlugin, getInstance } from "./utils/contracts";
import { loadPluginMetadata } from "../src/utils/metadata";
import { buildSingleTx } from "../src/utils/builder";
import { ISafeProtocolManager__factory, MockContract } from "../typechain-types";
import { MaxUint256, ZeroHash } from "ethers";
import { getProtocolManagerAddress } from "../src/utils/protocol";

describe("StopLossPlugin", async () => {
    // let user1: SignerWithAddress, user2: SignerWithAddress;

    before(async () => {
        // [user1, user2] = await hre.ethers.getSigners();
    });

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const manager = await ethers.getContractAt("MockContract", await getProtocolManagerAddress(hre));

        const account = await (await ethers.getContractFactory("ExecutableMockContract")).deploy();
        const plugin = await getStopLossPlugin(hre);
        return {
            account,
            plugin,
            manager,
        };
    });

    it("should be initialized correctly", async () => {
        const { plugin } = await setup();
        expect(await plugin.name()).to.be.eq("Stoploss Plugin");
        expect(await plugin.version()).to.be.eq("1.0.0");
        expect(await plugin.requiresRootAccess()).to.be.false;
    });

    it("can retrieve meta data for module", async () => {
        const { plugin } = await setup();
        expect(await loadPluginMetadata(hre, plugin)).to.be.deep.eq({
            name: "Stoploss Plugin",
            version: "1.0.0",
            requiresRootAccess: false,
            iconUrl: "",
            appUrl: "",
        });
    });

    it("should emit AddStopLoss when stoploss is added", async () => {
        const { plugin, account } = await setup();
        // const swapRouter2Uniswap = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
        const data = plugin.interface.encodeFunctionData("addStopLoss", [ethers.parseUnits("99", 6), "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"]);
        expect(await account.executeCallViaMock(await plugin.getAddress(), 0, data, MaxUint256))
            .to.emit(plugin, "AddStopLoss")
    });

    it("Should allow to execute transaction to for verified bot", async () => {
        const { plugin, account, manager } = await setup();
        const safeAddress = await account.getAddress();
        // AAVE ADDRESS = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
        // UNISWAP ROUTER ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
        const data = plugin.interface.encodeFunctionData("addStopLoss", [ethers.parseUnits("99", 6), "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"]);
        await account.executeCallViaMock(await plugin.getAddress(), 0, data, MaxUint256);
        // Required for isOwner(address) to return true
        account.givenMethodReturnBool("0x2f54bf6e", true);
        
    });
});
