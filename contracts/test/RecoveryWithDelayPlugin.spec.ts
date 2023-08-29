import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { getProtocolManagerAddress } from "../src/utils/protocol";
import { getRecoveryWithDelayPlugin } from "../src/utils/contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ISafeProtocolManager__factory } from "../typechain-types";
import { SafeProtocolAction, SafeRootAccess } from "../src/utils/dataTypes";
import { ZeroHash } from "ethers";

describe.skip("RecoverWithDelayPlugin", async () => {
    let deployer: SignerWithAddress, owner: SignerWithAddress, user1: SignerWithAddress, user2: SignerWithAddress, user3: SignerWithAddress;

    before(async () => {
        [deployer, owner, user1, user2, user3] = await hre.ethers.getSigners();
    });

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        const manager = await ethers.getContractAt("MockContract", await getProtocolManagerAddress(hre));
        const account = await (await ethers.getContractFactory("ExecutableMockContract")).deploy();
        const plugin = await getRecoveryWithDelayPlugin(hre);
        return {
            account,
            plugin,
            manager,
        };
    });

    it("Should call swap owner an a Safe account", async () => {
        const { account, plugin, manager } = await setup();

        expect(await plugin.connect(owner).executeFromPlugin(manager.target, account.target, user1.address, user2.address, user3.address))
            .to.emit(plugin, "OwnerReplaced")
            .withArgs(account.target, user2.address, user3.address);

        const managerInterface = ISafeProtocolManager__factory.createInterface();

        const safeInterface = new hre.ethers.Interface(["function swapOwner(address,address,address)"]);
        const data = safeInterface.encodeFunctionData("swapOwner", [user1.address, user2.address, user3.address]);

        const safeProtocolAction: SafeProtocolAction = {
            to: account.target,
            value: 0n,
            data: data,
        };

        const safeRootAccessTx: SafeRootAccess = { action: safeProtocolAction, nonce: 0n, metadataHash: ZeroHash };
        const callData = managerInterface.encodeFunctionData("executeRootAccess", [account.target, safeRootAccessTx]);
        expect(await manager.invocationCount()).to.equal(1);
        expect(await manager.invocationCountForCalldata(callData)).to.equal(1);
    });
});
