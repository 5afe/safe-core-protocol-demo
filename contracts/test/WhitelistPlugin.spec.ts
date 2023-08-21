import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getWhiteListPlugin, getInstance } from "../src/utils/contracts";
import { loadPluginMetadata } from "../src/utils/metadata";
import { buildSingleTx } from "../src/utils/builder";
import { ISafeProtocolManager__factory, MockContract } from "../typechain-types";
import { MaxUint256, ZeroHash } from "ethers";
import { getProtocolManagerAddress } from "../src/utils/protocol";

describe("WhitelistPlugin", async () => {
    let user1: SignerWithAddress, user2: SignerWithAddress;

    before(async () => {
        [user1, user2] = await hre.ethers.getSigners();
    });

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const manager = await ethers.getContractAt("MockContract", await getProtocolManagerAddress(hre));

        const account = await (await ethers.getContractFactory("ExecutableMockContract")).deploy();
        const plugin = await getWhiteListPlugin(hre);
        return {
            account,
            plugin,
            manager,
        };
    });

    it("should be initialized correctly", async () => {
        const { plugin } = await setup();
        expect(await plugin.name()).to.be.eq("Whitelist Plugin");
        expect(await plugin.version()).to.be.eq("1.0.0");
        expect(await plugin.requiresRootAccess()).to.be.false;
    });

    it("can retrieve meta data for module", async () => {
        const { plugin } = await setup();
        expect(await loadPluginMetadata(hre, plugin)).to.be.deep.eq({
            name: "Whitelist Plugin",
            version: "1.0.0",
            requiresRootAccess: false,
            iconUrl: "",
            appUrl: "",
        });
    });

    it("should emit AddressWhitelisted when account is whitelisted", async () => {
        const { plugin, account } = await setup();
        const data = plugin.interface.encodeFunctionData("addToWhitelist", [user1.address]);
        expect(await account.executeCallViaMock(await plugin.getAddress(), 0, data, MaxUint256))
            .to.emit(plugin, "AddressWhitelisted")
            .withArgs(user1.address);
    });

    it("Should not allow calls to non-whitelist address", async () => {
        const { plugin, account, manager } = await setup();

        // Required for isOwner(address) to return true
        account.givenMethodReturnBool("0x2f54bf6e", true);

        const safeTx = buildSingleTx(user2.address, 0n, "0x", 0n, hre.ethers.randomBytes(32));

        await expect(
            plugin.executeFromPlugin(await manager.getAddress(), await account.getAddress(), safeTx),
        ).to.be.revertedWithCustomError(plugin, "AddressNotWhiteListed");
    });

    it("Should not allow non-owner to execute transaction to whitelisted address", async () => {
        const { plugin, account, manager } = await setup();
        const safeAddress = await account.getAddress();
        const data = plugin.interface.encodeFunctionData("addToWhitelist", [user2.address]);
        await account.executeCallViaMock(await plugin.getAddress(), 0, data, MaxUint256);

        // Required for isOwner(address) to return false
        account.givenMethodReturnBool("0x2f54bf6e", false);

        const safeTx = buildSingleTx(user2.address, 0n, "0x", 0n, ZeroHash);
        await expect(plugin.connect(user1).executeFromPlugin(manager.target, safeAddress, safeTx))
            .to.be.revertedWithCustomError(plugin, "CallerIsNotOwner")
            .withArgs(safeAddress, user1.address);

        const managerInterface = ISafeProtocolManager__factory.createInterface();
        const expectedData = managerInterface.encodeFunctionData("executeTransaction", [account.target, safeTx]);

        expect(await manager.invocationCount()).to.be.eq(0);
        expect(await manager.invocationCountForMethod(expectedData)).to.be.eq(0);
    });

    it("Should allow to execute transaction to whitelisted address", async () => {
        const { plugin, account, manager } = await setup();
        const safeAddress = await account.getAddress();
        const data = plugin.interface.encodeFunctionData("addToWhitelist", [user2.address]);
        await account.executeCallViaMock(await plugin.getAddress(), 0, data, MaxUint256);
        // Required for isOwner(address) to return true
        account.givenMethodReturnBool("0x2f54bf6e", true);

        const safeTx = buildSingleTx(user2.address, 0n, "0x", 0n, ZeroHash);
        expect(await plugin.connect(user1).executeFromPlugin(manager.target, safeAddress, safeTx));

        const managerInterface = ISafeProtocolManager__factory.createInterface();
        const expectedData = managerInterface.encodeFunctionData("executeTransaction", [account.target, safeTx]);

        expect(await manager.invocationCount()).to.be.eq(1);
        expect(await manager.invocationCountForMethod(expectedData)).to.be.eq(1);
    });

    it("Should not allow to execute transaction after removing address from whitelist ", async () => {
        const { plugin, account, manager } = await setup();
        const safeAddress = await account.getAddress();

        // Required for isOwner(address) to return true
        account.givenMethodReturnBool("0x2f54bf6e", true);

        const data = plugin.interface.encodeFunctionData("addToWhitelist", [user2.address]);
        await account.executeCallViaMock(await plugin.getAddress(), 0, data, MaxUint256);

        const data2 = plugin.interface.encodeFunctionData("removeFromWhitelist", [user2.address]);
        expect(await account.executeCallViaMock(await plugin.getAddress(), 0, data2, MaxUint256))
            .to.emit(plugin, "AddressRemovedFromWhitelist")
            .withArgs(user1.address);

        const safeTx = buildSingleTx(user2.address, 0n, "0x", 0n, ZeroHash);

        await expect(plugin.connect(user1).executeFromPlugin(manager.target, safeAddress, safeTx))
            .to.be.revertedWithCustomError(plugin, "AddressNotWhiteListed")
            .withArgs(user2.address);

        const mockInstance = await getInstance<MockContract>(hre, "MockContract", manager.target);
        expect(await mockInstance.invocationCount()).to.be.eq(0);
    });
});
