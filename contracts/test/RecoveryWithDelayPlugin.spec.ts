import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { getProtocolManagerAddress } from "../src/utils/protocol";
import { getRecoveryWithDelayPlugin } from "../src/utils/contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ISafeProtocolManager__factory } from "../typechain-types";
import { SafeProtocolAction, SafeRootAccess } from "../src/utils/dataTypes";
import { MaxUint256, ZeroHash } from "ethers";

describe("RecoverWithDelayPlugin", () => {
    let deployer: SignerWithAddress,
        recoverer: SignerWithAddress,
        user1: SignerWithAddress,
        user2: SignerWithAddress,
        user3: SignerWithAddress;

    const validityDuration = 60 * 60 * 24 * 100; // 100 days

    before(async () => {
        [deployer, recoverer, user1, user2, user3] = await hre.ethers.getSigners();
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

    it("Should revert due to past execution time", async () => {
        const { account, plugin, manager } = await setup();
        await expect(
            plugin
                .connect(recoverer)
                .createAnnouncement(manager.target, account.target, user1.address, user2.address, user3.address, 0n, 0, validityDuration),
        ).to.be.revertedWithCustomError(plugin, "ExecutionTimeShouldBeInFuture");
    });

    it("Should call swap owner an a Safe account", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0n,
                    timestamp + 10,
                    validityDuration,
                ),
        );
        await hre.ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 10]); // 10 days
        await hre.ethers.provider.send("evm_mine");

        const managerInterface = ISafeProtocolManager__factory.createInterface();

        expect(
            await plugin
                .connect(deployer)
                .executeFromPlugin(manager.target, account.target, user1.address, user2.address, user3.address, 0n),
        )
            .to.emit(plugin, "OwnerReplaced")
            .withArgs(account.target, user2.address, user3.address);

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

    it("Should revert with TransactionExecutionValidityExpired when execution transaction after validity duration", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0n,
                    timestamp + 10,
                    validityDuration,
                ),
        );
        await hre.ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 101]); // 101 days
        await hre.ethers.provider.send("evm_mine");

        await expect(
            plugin.connect(user1).executeFromPlugin(manager.target, account.target, user1.address, user2.address, user3.address, 0n),
        ).to.be.revertedWithCustomError(plugin, "TransactionExecutionValidityExpired");
    });

    it("Should block swapping owner if execution time is not passed", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0,
                    timestamp + 10,
                    validityDuration,
                ),
        );

        await expect(
            plugin.connect(user1).executeFromPlugin(manager.target, account.target, user1.address, user2.address, user3.address, 0n),
        ).to.be.revertedWithCustomError(plugin, "TransactionExecutionNotAllowedYet");
    });

    it("Should allow execution only once", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0,
                    timestamp + 10,
                    validityDuration,
                ),
        );

        await hre.ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 10]);
        await hre.ethers.provider.send("evm_mine");

        expect(
            await plugin.connect(user1).executeFromPlugin(manager.target, account.target, user1.address, user2.address, user3.address, 0n),
        )
            .to.emit(plugin, "OwnerReplaced")
            .withArgs(account.target, user2.address, user3.address);

        await expect(
            plugin.connect(user2).executeFromPlugin(manager.target, account.target, user1.address, user2.address, user3.address, 0n),
        ).to.be.revertedWithCustomError(plugin, "TransactionAlreadyExecuted");
    });

    it("Should allow creation of announcement only once", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;

        const txHash = await plugin.getTransactionHash(manager.target, account.target, user1.address, user2.address, user3.address, 0);
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0,
                    timestamp + 10,
                    validityDuration,
                ),
        )
            .to.emit(plugin, "NewRecoveryAnnouncement")
            .withArgs(account.target, txHash);

        await expect(
            plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0,
                    timestamp + 10,
                    validityDuration,
                ),
        ).to.be.revertedWithCustomError(plugin, "TransactionAlreadyScheduled");
    });

    it("Allow only recoverer to create announcement", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;

        await expect(
            plugin
                .connect(user1)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0,
                    timestamp + 10,
                    validityDuration,
                ),
        ).to.be.revertedWithCustomError(plugin, "CallerNotValidRecoverer");
    });

    it("Should allow cancellation only once", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0,
                    timestamp + 10,
                    validityDuration,
                ),
        );

        expect(
            await plugin
                .connect(recoverer)
                .cancelAnnouncement(manager.target, account.target, user1.address, user2.address, user3.address, 0),
        );

        await expect(
            plugin.connect(recoverer).cancelAnnouncement(manager.target, account.target, user1.address, user2.address, user3.address, 0),
        ).to.be.revertedWithCustomError(plugin, "TransactionNotFound");
    });

    it("Should allow only recoverer to cancel an announcement", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0,
                    timestamp + 10,
                    validityDuration,
                ),
        );

        await expect(
            plugin.connect(user2).cancelAnnouncement(manager.target, account.target, user1.address, user2.address, user3.address, 0),
        ).to.be.revertedWithCustomError(plugin, "CallerNotValidRecoverer");
    });

    it("Should cancel an announcement", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0,
                    timestamp + 10,
                    validityDuration,
                ),
        );

        expect(
            await plugin
                .connect(recoverer)
                .cancelAnnouncement(manager.target, account.target, user1.address, user2.address, user3.address, 0),
        ).to.emit(plugin, "RecoveryAnnouncementCancelled");
    });

    it("Should not allow cancellation after execution", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0,
                    timestamp + 10,
                    validityDuration,
                ),
        );

        await hre.ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 10]);
        await hre.ethers.provider.send("evm_mine");

        expect(
            await plugin.connect(user1).executeFromPlugin(manager.target, account.target, user1.address, user2.address, user3.address, 0n),
        )
            .to.emit(plugin, "OwnerReplaced")
            .withArgs(account.target, user2.address, user3.address);

        await expect(
            plugin.connect(recoverer).cancelAnnouncement(manager.target, account.target, user1.address, user2.address, user3.address, 0n),
        ).to.be.revertedWithCustomError(plugin, "TransactionAlreadyExecuted");
    });

    it("Should cancel an announcement from the account", async () => {
        const { account, plugin, manager } = await setup();

        const timestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
        expect(
            await plugin
                .connect(recoverer)
                .createAnnouncement(
                    manager.target,
                    account.target,
                    user1.address,
                    user2.address,
                    user3.address,
                    0n,
                    timestamp + 10,
                    validityDuration,
                ),
        );
        await hre.ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 10]); // 10 days
        await hre.ethers.provider.send("evm_mine");

        const data = plugin.interface.encodeFunctionData("cancelAnnouncementFromAccount", [
            manager.target,
            user1.address,
            user2.address,
            user3.address,
            0n,
        ]);
        await account.executeCallViaMock(plugin.target, 0n, data, MaxUint256);

        expect(
            await plugin.connect(user1).executeFromPlugin(manager.target, account.target, user1.address, user2.address, user3.address, 0n),
        ).to.be.revertedWithCustomError(plugin, "TransactionExecutionNotAllowedYet");
    });
});
