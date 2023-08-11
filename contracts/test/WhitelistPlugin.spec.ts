import hre, { deployments } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getWhiteListPlugin, getRegistry, getManager, getInstance } from "../src/utils/contracts";
import { loadPluginMetadata } from "../src/utils/metadata";
import { IntegrationType } from "../src/utils/constants";
import { buildSingleTx } from "../src/utils/builder";
import { MockContract } from "../typechain-types";
import { ZeroHash } from "ethers";

describe("WhitelistPlugin", async () => {
    let user1: SignerWithAddress, user2: SignerWithAddress, user3: SignerWithAddress;

    before(async () => {
        [user1, user2, user3] = await hre.ethers.getSigners();
    });

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const plugin = await getWhiteListPlugin(hre);
        const registry = await getRegistry(hre);
        const safe = await (await hre.ethers.getContractFactory("TestExecutor")).deploy();
        const manager = await getManager(hre);

        registry.addIntegration(await plugin.getAddress(), IntegrationType.Plugin);

        safe.setModule(await manager.getAddress());

        return {
            plugin,
            registry,
            safe,
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
        const { plugin, safe } = await setup();
        const data = plugin.interface.encodeFunctionData("addToWhitelist", [user1.address]);
        expect(await safe.exec(await plugin.getAddress(), 0, data))
            .to.emit(plugin, "AddressWhitelisted")
            .withArgs(user1.address);
    });

    it("Should not allow calls to non-whitelist address", async () => {
        const { plugin, safe, manager } = await setup();

        const safeTx = buildSingleTx(user3.address, 0n, "0x", 0n, hre.ethers.randomBytes(32));

        await expect(
            plugin.connect(user2).executeFromPlugin(await manager.getAddress(), await safe.getAddress(), safeTx),
        ).to.be.revertedWithCustomError(plugin, "AddressNotWhiteListed");
    });

    it("Should allow to execute transaction to whitelisted address", async () => {
        const { plugin, safe, manager } = await setup();
        const safeAddress = await safe.getAddress();
        const data = plugin.interface.encodeFunctionData("addToWhitelist", [user3.address]);
        await safe.exec(await plugin.getAddress(), 0, data);

        const safeTx = buildSingleTx(user3.address, 0n, "0x", 0n, ZeroHash);
        expect(await plugin.connect(user1).executeFromPlugin(manager.target, safeAddress, safeTx));

        const expectedData = manager.interface.encodeFunctionData("executeTransaction", [safe.target, safeTx]);

        const mockInstance = await getInstance<MockContract>(hre, "MockContract", manager.target);
        expect(await mockInstance.invocationCount()).to.be.eq(1);
        expect(await mockInstance.invocationCountForMethod(expectedData)).to.be.eq(1);
    });

    it("Should not allow to execute transaction after removing address from whitelist ", async () => {
        const { plugin, safe, manager } = await setup();
        const safeAddress = await safe.getAddress();
        const data = plugin.interface.encodeFunctionData("addToWhitelist", [user3.address]);
        await safe.exec(await plugin.getAddress(), 0, data);

        const data2 = plugin.interface.encodeFunctionData("removeFromWhitelist", [user3.address]);
        expect(await safe.exec(await plugin.getAddress(), 0, data2))
            .to.emit(plugin, "AddressRemovedFromWhitelist")
            .withArgs(user1.address);

        const safeTx = buildSingleTx(user3.address, 0n, "0x", 0n, ZeroHash);

        await expect(plugin.connect(user1).executeFromPlugin(manager.target, safeAddress, safeTx))
            .to.be.revertedWithCustomError(plugin, "AddressNotWhiteListed")
            .withArgs(user3.address);

        const mockInstance = await getInstance<MockContract>(hre, "MockContract", manager.target);
        expect(await mockInstance.invocationCount()).to.be.eq(0);
    });
});
