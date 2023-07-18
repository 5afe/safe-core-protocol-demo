import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getRelayPlugin } from "../src/utils/contracts";
import { loadPluginMetadata } from "../src/utils/metadata";
import { getProtocolManagerAddress } from "../src/utils/protocol";
import { Interface, MaxUint256, ZeroAddress, ZeroHash, getAddress, keccak256 } from "ethers";
import { ISafeProtocolManager__factory } from "../typechain-types";

describe("RelayPlugin", async () => {
    const TOKEN_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const abiEncoder = ethers.AbiCoder.defaultAbiCoder();
    let relayer: SignerWithAddress;

    before(async () => {
        [relayer] = await hre.ethers.getSigners();
    });

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const manager = await ethers.getContractAt("MockContract", await getProtocolManagerAddress(hre));
        const account = await (await ethers.getContractFactory("ExecutableMockContract")).deploy();
        const plugin = await getRelayPlugin(hre);
        return {
            account,
            plugin,
            manager,
        };
    });

    const addRelayContext = (data: string, fee: string, feeToken: string = ZeroAddress, decimals: number = 18) => {
        return (
            data +
            relayer.address.slice(2) +
            getAddress(feeToken).slice(2) +
            abiEncoder.encode(["uint256"], [ethers.parseUnits(fee, decimals)]).slice(2)
        );
    };

    it("should be inititalized correctly", async () => {
        const { plugin } = await setup();
        expect(await plugin.name()).to.be.eq("Relay Plugin");
        expect(await plugin.version()).to.be.eq("1.0.0");
        expect(await plugin.requiresRootAccess()).to.be.false;
    });

    it("can retrieve metadata for module", async () => {
        const { plugin } = await setup();
        expect(await loadPluginMetadata(hre, plugin)).to.be.deep.eq({
            name: "Relay Plugin",
            version: "1.0.0",
            requiresRootAccess: false,
            iconUrl: "",
            appUrl: "https://5afe.github.io/safe-core-protocol-demo/#/relay/${plugin}",
        });
    });

    it("should revert if invalid method selector is used", async () => {
        const { account, plugin, manager } = await setup();
        await expect(plugin.executeFromPlugin(await manager.getAddress(), await account.getAddress(), "0xbaddad42"))
            .to.be.revertedWithCustomError(plugin, "InvalidRelayMethod")
            .withArgs("0xbaddad42");
    });

    it("should revert if target contract reverts", async () => {
        const { account, plugin, manager } = await setup();
        await account.givenMethodRevert("0x6a761202");
        await expect(plugin.executeFromPlugin(await manager.getAddress(), await account.getAddress(), "0x6a761202"))
            .to.be.revertedWithCustomError(plugin, "RelayExecutionFailure")
            .withArgs(
                "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000",
            );
    });

    it("should revert if fee is too high", async () => {
        const { account, plugin, manager } = await setup();
        const tx = (await plugin.executeFromPlugin.populateTransaction(await manager.getAddress(), account, "0x6a761202")).data;
        await expect(relayer.sendTransaction({ to: plugin, data: addRelayContext(tx, "0.01") }))
            .to.be.revertedWithCustomError(plugin, "FeeTooHigh(address,uint256)")
            .withArgs(ZeroAddress, ethers.parseUnits("0.01", 18));
    });

    it("should revert if fee payment fails", async () => {
        const { account, plugin, manager } = await setup();
        const setupTx = await plugin.setMaxFeePerToken.populateTransaction(ZeroAddress, ethers.parseUnits("0.01", 18));
        await account.executeCallViaMock(setupTx.to, setupTx.value || 0, setupTx.data, MaxUint256);
        expect(await plugin.maxFeePerToken(account, ZeroAddress)).to.be.eq(ethers.parseUnits("0.01", 18));
        await manager.givenAnyRevert();
        const tx = (await plugin.executeFromPlugin.populateTransaction(await manager.getAddress(), account, "0x6a761202")).data;
        await expect(relayer.sendTransaction({ to: plugin, data: addRelayContext(tx, "0.01") }))
            .to.be.revertedWithCustomError(plugin, "FeePaymentFailure")
            .withArgs(
                "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000",
            );
    });

    it("should be a success with native token", async () => {
        const { account, plugin, manager } = await setup();
        const setupTx = await plugin.setMaxFeePerToken.populateTransaction(ZeroAddress, ethers.parseUnits("0.01", 18));
        await account.executeCallViaMock(setupTx.to, setupTx.value || 0, setupTx.data, MaxUint256);
        expect(await plugin.maxFeePerToken(account, ZeroAddress)).to.be.eq(ethers.parseUnits("0.01", 18));
        const tx = (await plugin.executeFromPlugin.populateTransaction(await manager.getAddress(), account, "0x6a761202")).data;
        await expect(relayer.sendTransaction({ to: plugin, data: addRelayContext(tx, "0.01") })).to.not.be.reverted;
        expect(await account.invocationCount()).to.be.eq(1);
        expect(await account.invocationCountForCalldata("0x6a761202")).to.be.eq(1);

        const nonce = keccak256(
            abiEncoder.encode(
                ["address", "address", "address", "bytes"],
                [await plugin.getAddress(), await manager.getAddress(), await account.getAddress(), "0x6a761202"],
            ),
        );
        const managerInterface = ISafeProtocolManager__factory.createInterface();
        const expectedData = managerInterface.encodeFunctionData("executeTransaction", [
            await account.getAddress(),
            {
                nonce,
                metadataHash: ZeroHash,
                actions: [
                    {
                        to: relayer.address,
                        value: ethers.parseUnits("0.01", 18),
                        data: "0x",
                    },
                ],
            },
        ]);
        expect(await manager.invocationCount()).to.be.eq(1);
        expect(await manager.invocationCountForMethod(expectedData)).to.be.eq(1);
    });

    it("should be a success with fee token", async () => {
        const { account, plugin, manager } = await setup();
        const maxFee = ethers.parseUnits("0.02", 18);
        const setupTx = await plugin.setMaxFeePerToken.populateTransaction(TOKEN_ADDRESS, maxFee);
        await account.executeCallViaMock(setupTx.to, setupTx.value || 0, setupTx.data, MaxUint256);
        expect(await plugin.maxFeePerToken(account, TOKEN_ADDRESS)).to.be.eq(maxFee);
        const tx = (await plugin.executeFromPlugin.populateTransaction(await manager.getAddress(), account, "0x6a761202")).data;
        await expect(relayer.sendTransaction({ to: plugin, data: addRelayContext(tx, "0.02", TOKEN_ADDRESS) })).to.not.be.reverted;
        expect(await account.invocationCount()).to.be.eq(1);
        expect(await account.invocationCountForCalldata("0x6a761202")).to.be.eq(1);

        const tokenInterface = new Interface(["function transfer(address,uint256)"]);
        const encodedTransfer = tokenInterface.encodeFunctionData("transfer", [relayer.address, maxFee]);
        const managerInterface = ISafeProtocolManager__factory.createInterface();
        const nonce = keccak256(
            abiEncoder.encode(
                ["address", "address", "address", "bytes"],
                [await plugin.getAddress(), await manager.getAddress(), await account.getAddress(), "0x6a761202"],
            ),
        );
        const expectedData = managerInterface.encodeFunctionData("executeTransaction", [
            await account.getAddress(),
            {
                nonce,
                metadataHash: ZeroHash,
                actions: [
                    {
                        to: TOKEN_ADDRESS,
                        value: 0,
                        data: encodedTransfer,
                    },
                ],
            },
        ]);
        expect(await manager.invocationCount()).to.be.eq(1);
        expect(await manager.invocationCountForMethod(expectedData)).to.be.eq(1);
    });
});
