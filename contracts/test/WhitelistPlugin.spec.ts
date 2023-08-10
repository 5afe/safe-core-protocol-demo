import hre, { deployments } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getWhiteListPlugin, getRegistry, getManager } from "../src/utils/contracts";
import { loadPluginMetadata } from "../src/utils/metadata";
import { IntegrationType } from "../src/utils/constants";
import { buildSingleTx } from "../src/utils/builder";

describe("WhitelistPlugin", async () => {
    let deployer: SignerWithAddress, owner: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress, user3: SignerWithAddress;

    before(async () => {
        [deployer, owner, user1, user2, user3] = await hre.ethers.getSigners();
    });

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const plugin = await getWhiteListPlugin(hre);
        const registry = await getRegistry(hre);
        const safe = await (await hre.ethers.getContractFactory("TestExecutor")).deploy();
        const manager = await getManager(hre);

        registry.addIntegration(await plugin.getAddress(), IntegrationType.Plugin);

        safe.setModule(await manager.getAddress());

        const data = manager.interface.encodeFunctionData("enablePlugin", [await plugin.getAddress(), false]);
        await safe.exec(await manager.getAddress(), 0, data);

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

    it("Should not allow non-whitelist address to execute transaction", async () => {
        const { plugin, safe, manager } = await setup();

        const safeTx = buildSingleTx(user3.address, 0n, "0x", 0n, hre.ethers.randomBytes(32));

        await expect(
            plugin.connect(user2).executeFromPlugin(await manager.getAddress(), await safe.getAddress(), safeTx),
        ).to.be.revertedWithCustomError(plugin, "AddressNotWhiteListed");
    });

    it("Should allow whitelisted address to execute transaction", async () => {
        const { plugin, safe, manager } = await setup();
        const safeAddress = await safe.getAddress();
        const data = plugin.interface.encodeFunctionData("addToWhitelist", [user1.address]);
        await safe.exec(await plugin.getAddress(), 0, data);

        const amount = 10n ** 18n;

        await (
            await deployer.sendTransaction({
                to: safeAddress,
                value: amount,
            })
        ).wait();

        const safeTx = buildSingleTx(user3.address, amount, "0x", 0n, hre.ethers.randomBytes(32));
        expect(await plugin.connect(user1).executeFromPlugin(await manager.getAddress(), safeAddress, safeTx));
    });

    it("Should not allow removed address from whitelist to execute transaction", async () => {
        const { plugin, safe, manager } = await setup();
        const safeAddress = await safe.getAddress();
        const data = plugin.interface.encodeFunctionData("addToWhitelist", [user1.address]);
        await safe.exec(await plugin.getAddress(), 0, data);

        const data2 = plugin.interface.encodeFunctionData("removeFromWhitelist", [user1.address]);
        expect(await safe.exec(await plugin.getAddress(), 0, data2))
            .to.emit(plugin, "AddressRemovedFromWhitelist")
            .withArgs(user1.address);

        const amount = 10n ** 18n;
        const safeTx = buildSingleTx(user3.address, amount, "0x", 0n, hre.ethers.randomBytes(32));

        await expect(
            plugin.connect(user1).executeFromPlugin(await manager.getAddress(), safeAddress, safeTx),
        ).to.be.revertedWithCustomError(plugin, "AddressNotWhiteListed");
    });
});
