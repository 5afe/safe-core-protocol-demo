import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { AbiCoder, keccak256, JsonRpcProvider, ZeroAddress, toUtf8String, toUtf8Bytes } from "ethers";
import { loadPluginMetadata } from "../src/utils/metadata";
import { getProtocolManagerAddress } from "../src/utils/protocol";
import { deploySafe, getSafeProxyFactoryContractFactory, getSafeSingletonContractFactory } from "./utils/safe";
import { ModuleType } from "../src/utils/constants";
import { UserOperation } from "./utils/types";
import { BigNumberish } from "ethers";
import { ERC4337Plugin, IEntryPoint } from "../typechain-types";

const ERC4337_TEST_ENV_VARIABLES_DEFINED =
    typeof process.env.ERC4337_TEST_BUNDLER_URL !== "undefined" &&
    typeof process.env.ERC4337_TEST_NODE_URL !== "undefined" &&
    typeof process.env.ERC4337_TEST_SAFE_FACTORY_ADDRESS !== "undefined" &&
    typeof process.env.ERC4337_TEST_SINGLETON_ADDRESS !== "undefined" &&
    typeof process.env.ERC4337_TEST_MNEMONIC !== "undefined" &&
    typeof process.env.ERC4337_TEST_SAFE_CORE_PROTOCOL_MANAGER_ADDRESS !== "undefined" &&
    typeof process.env.ERC4337_TEST_SAFE_CORE_PROTOCOL_REGISTRY !== "undefined" &&
    typeof process.env.ERC4337_TEST_SAFE_CORE_PROTOCOL_FUNCTION_HANDLER !== "undefined";

const itif = ERC4337_TEST_ENV_VARIABLES_DEFINED ? it : it.skip;
const SAFE_FACTORY_ADDRESS = process.env.ERC4337_TEST_SAFE_FACTORY_ADDRESS;
const SINGLETON_ADDRESS = process.env.ERC4337_TEST_SINGLETON_ADDRESS;
const BUNDLER_URL = process.env.ERC4337_TEST_BUNDLER_URL;
const NODE_URL = process.env.ERC4337_TEST_NODE_URL;
const MNEMONIC = process.env.ERC4337_TEST_MNEMONIC;
const SAFE_CORE_PROTOCOL_MANAGER_ADDRESS = process.env.ERC4337_TEST_SAFE_CORE_PROTOCOL_MANAGER_ADDRESS;
const SAFE_CORE_PROTOCOL_FUNCTION_HANDLER = process.env.ERC4337_TEST_SAFE_CORE_PROTOCOL_FUNCTION_HANDLER || ZeroAddress;
const SAFE_CORE_PROTOCOL_REGISTRY = process.env.ERC4337_TEST_SAFE_CORE_PROTOCOL_REGISTRY;
const FOUR337_PLUGIN_ADDRESS = process.env.ERC4337_TEST_4337_PLUGIN_ADDRESS;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const packUserOp = (op: UserOperation): string =>
    AbiCoder.defaultAbiCoder().encode(
        [
            "address", // sender
            "uint256", // nonce
            "bytes32", // initCode
            "bytes32", // callData
            "uint256", // callGasLimit
            "uint256", // verificationGasLimit
            "uint256", // preVerificationGas
            "uint256", // maxFeePerGas
            "uint256", // maxPriorityFeePerGas
            "bytes32", // paymasterAndData
        ],
        [
            op.sender,
            op.nonce,
            keccak256(op.initCode),
            keccak256(op.callData),
            op.callGasLimit,
            op.verificationGasLimit,
            op.preVerificationGas,
            op.maxFeePerGas,
            op.maxPriorityFeePerGas,
            keccak256(op.paymasterAndData),
        ],
    );

const getUserOpHash = (op: UserOperation, entryPoint: string, chainId: BigNumberish): string => {
    const userOpHash = keccak256(packUserOp(op));
    const enc = AbiCoder.defaultAbiCoder().encode(["bytes32", "address", "uint256"], [userOpHash, entryPoint, chainId]);
    return keccak256(enc);
};

describe.only("ERC4337 Plugin", () => {
    const hardhatNetworkSetup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await hre.ethers.getSigners();
        const entryPoint = signers[signers.length - 1];
        const manager = await ethers.getContractAt("MockContract", await getProtocolManagerAddress(hre));

        const testRegistryDeployment = await ethers
            .getContractFactory("TestSafeProtocolRegistryUnrestricted")
            .then((factory) => factory.deploy(signers[0].address));
        const safeProtocolManager = await ethers
            .getContractFactory("SafeProtocolManager")
            .then((factory) => factory.deploy(signers[0].address, testRegistryDeployment.getAddress()));

        // This code should be uncommented after release a npm package that has separate FunctionHandlerManager
        // const safeProtocolFunctionHandler = await ethers
        //     .getContractFactory("FunctionHandlerManager")
        //     .then((factory) => factory.deploy(signers[0].address, testRegistryDeployment.getAddress()));

        const safeProtocolFunctionHandler = await ethers.deployContract("MockContract");

        const erc4337Plugin = await ethers
            .getContractFactory("ERC4337Plugin")
            .then((factory) =>
                factory.deploy(safeProtocolManager.getAddress(), safeProtocolFunctionHandler.target, entryPoint.getAddress()),
            );

        console.log("erc4337 plugin", erc4337Plugin.target);

        await testRegistryDeployment
            .addModule(erc4337Plugin.getAddress(), ModuleType.Plugin + ModuleType.FunctionHandler)
            .then((tx) => tx.wait(1));

        const account = await ethers.getContractFactory("ExecutableMockContract").then((f) => f.deploy());
        const proxyFactory = await getSafeProxyFactoryContractFactory().then((f) => f.deploy());
        const safeSingleton = await getSafeSingletonContractFactory().then((f) => f.deploy());

        const callData = erc4337Plugin.interface.encodeFunctionData("enableSafeCoreProtocolWith4337Plugin");
        const safe = await deploySafe(proxyFactory, safeSingleton, [signers[0].address], 1, await erc4337Plugin.getAddress(), callData);
        const safeWithPluginInterface = await ethers.getContractAt("ERC4337Plugin", safe);

        return {
            account,
            erc4337Plugin,
            manager,
            signers,
            safe,
            entryPoint,
            safeWithPluginInterface,
        };
    });

    const integrationTestSetup = async () => {
        // make typescript happy
        const ERC4337_TEST_ENV_VARIABLES_DEFINED =
            typeof BUNDLER_URL !== "undefined" &&
            typeof NODE_URL !== "undefined" &&
            typeof SAFE_FACTORY_ADDRESS !== "undefined" &&
            typeof SINGLETON_ADDRESS !== "undefined" &&
            typeof MNEMONIC !== "undefined" &&
            typeof SAFE_CORE_PROTOCOL_MANAGER_ADDRESS !== "undefined" &&
            typeof SAFE_CORE_PROTOCOL_REGISTRY !== "undefined";

        if (!ERC4337_TEST_ENV_VARIABLES_DEFINED) {
            throw new Error("ERC4337_TEST_* environment variables not defined");
        }

        const bundlerProvider = new JsonRpcProvider(BUNDLER_URL, undefined, { batchMaxCount: 1 });
        const provider = new hre.ethers.JsonRpcProvider(NODE_URL);

        const mnemonic = hre.ethers.Mnemonic.fromPhrase(MNEMONIC);
        const wallet = hre.ethers.HDNodeWallet.fromMnemonic(mnemonic).connect(provider);
        const safeProxyFactory = await hre.ethers.getContractAt("SafeProxyFactory", SAFE_FACTORY_ADDRESS, wallet);
        const safeSingleton = await hre.ethers.getContractAt("Safe", SINGLETON_ADDRESS, wallet);
        const safeProtocolManager = await hre.ethers.getContractAt("SafeProtocolManager", SAFE_CORE_PROTOCOL_MANAGER_ADDRESS, wallet);
        const safeProtocolRegistry = await hre.ethers.getContractAt("SafeProtocolRegistry", SAFE_CORE_PROTOCOL_REGISTRY, wallet);

        const entryPoints = await bundlerProvider.send("eth_supportedEntryPoints", []);
        if (entryPoints.length === 0) {
            throw new Error("No entry points found");
        }
        console.log(`Entrypoint address: ${entryPoints[0]}`);

        let erc4337Plugin: ERC4337Plugin;
        if (FOUR337_PLUGIN_ADDRESS) {
            console.log(`Using 4337 Plugin address from the environment variable`);
            erc4337Plugin = await hre.ethers.getContractAt("ERC4337Plugin", FOUR337_PLUGIN_ADDRESS, wallet);
        } else {
            console.log(`Deploying ERC4337Plugin...`);
            erc4337Plugin = await ethers
                .getContractFactory("ERC4337Plugin", wallet)
                .then((factory) => factory.deploy(SAFE_CORE_PROTOCOL_MANAGER_ADDRESS, SAFE_CORE_PROTOCOL_FUNCTION_HANDLER, entryPoints[0]))
                .then((tx) => tx.waitForDeployment());
            await sleep(10000);
            console.log(`Deployed ERC4337Plugin at ${await erc4337Plugin.getAddress()}`);

            console.log(`Registering ERC4337Plugin at the Safe Protocol Registry...`);
            await safeProtocolRegistry
                .addModule(await erc4337Plugin.getAddress(), ModuleType.Plugin + ModuleType.FunctionHandler)
                .then((tx) => tx.wait(1));
            console.log(`Registered ERC4337Plugin at the Safe Protocol Registry`);
        }

        const entryPoint = await ethers.getContractAt("IEntryPoint", entryPoints[0], wallet);

        console.log(`ERC4337Plugin deployed at ${await erc4337Plugin.getAddress()}`);

        return {
            wallet,
            safeProxyFactory,
            safeSingleton,
            safeProtocolManager,
            entryPoint,
            bundlerProvider,
            erc4337Plugin,
            provider,
        };
    };

    const addAccountDepositExternally = async (entryPoint: IEntryPoint, account: string, amount: string) => {
        const entryPointInterface = new hre.ethers.Interface(["function depositTo(address)"]);
        // const data = entryPointInterface.encodeFunctionData("depositTo", [account]);
        // console.log(await entryPoint.balanceOf.staticCall(account));
        if ((await entryPoint.balanceOf.staticCall(account)) === 0n) {
            console.log("Sending deposit to entrypoint:", account, amount);
            await entryPoint.depositTo(account, { value: amount });
            await sleep(20000);
        }
    };

    it.skip("should be initialized correctly", async () => {
        const { erc4337Plugin } = await hardhatNetworkSetup();
        expect(await erc4337Plugin.name()).to.be.eq("ERC4337 Plugin");
        expect(await erc4337Plugin.version()).to.be.eq("1.0.0");
        expect(await erc4337Plugin.permissions()).to.be.eq(1);
    });

    it.skip("can retrieve metadata for the module", async () => {
        const { erc4337Plugin } = await hardhatNetworkSetup();
        expect(await loadPluginMetadata(hre, erc4337Plugin)).to.be.deep.eq({
            name: "ERC4337 Plugin",
            version: "1.0.0",
            permissions: 1,
            iconUrl: "",
            appUrl: "",
        });
    });

    it.skip("can validate a signed user operation and send the prefund", async () => {
        const { erc4337Plugin, signers, safe, safeWithPluginInterface, entryPoint } = await hardhatNetworkSetup();

        const userOperation: UserOperation = {
            initCode: "0x",
            sender: await safe.getAddress(),
            nonce: 0,
            callData: "0x",
            callGasLimit: 0,
            verificationGasLimit: 0,
            preVerificationGas: 0,
            maxFeePerGas: 0,
            maxPriorityFeePerGas: 0,
            paymasterAndData: "0x",
            signature: "0x",
        };
        const userOpHash = await getUserOpHash(
            userOperation,
            await erc4337Plugin.getAddress(),
            await hre.ethers.provider.getNetwork().then((n) => n.chainId),
        );

        const signature = await signers[0].signMessage(ethers.getBytes(userOpHash));
        userOperation.signature = `0x${(BigInt(signature) + 4n).toString(16)}`;

        const entryPointBalanceBefore = await hre.ethers.provider.getBalance(entryPoint.address);
        // prefund safe
        await signers[0].sendTransaction({ to: safe, value: 1000000000000000000n });

        const tx = await safeWithPluginInterface.connect(entryPoint).validateUserOp(userOperation, userOpHash, 1000000000000000000n);
        const receipt = await tx.wait(1);

        if (!receipt?.gasPrice || !receipt?.gasUsed) throw new Error("Gas price or gas used not found in receipt");

        expect(await hre.ethers.provider.getBalance(entryPoint.address)).to.be.eq(
            entryPointBalanceBefore + 1000000000000000000n - receipt.gasPrice * receipt.gasUsed,
        );
        expect(await hre.ethers.provider.getBalance(safe)).to.be.eq(0);
    });

    it.skip("rejects a signed user operation if the signature is invalid", async () => {
        const { erc4337Plugin, signers, safe, safeWithPluginInterface, entryPoint } = await hardhatNetworkSetup();

        const userOperation: UserOperation = {
            initCode: "0x",
            sender: await safe.getAddress(),
            nonce: 0,
            callData: "0x",
            callGasLimit: 0,
            verificationGasLimit: 0,
            preVerificationGas: 0,
            maxFeePerGas: 0,
            maxPriorityFeePerGas: 0,
            paymasterAndData: "0x",
            signature: "0x",
        };
        const userOpHash = await getUserOpHash(
            userOperation,
            await erc4337Plugin.getAddress(),
            await hre.ethers.provider.getNetwork().then((n) => n.chainId),
        );
        const zeroBytes32 = `0x${"0".repeat(64)}`;

        const signature = await signers[0].signMessage(ethers.getBytes(zeroBytes32));
        userOperation.signature = `0x${(BigInt(signature) + 4n).toString(16)}`;
        // prefund safe
        await signers[0].sendTransaction({ to: safe, value: 1000000000000000000n });

        expect(
            await safeWithPluginInterface.connect(entryPoint).validateUserOp.staticCall(userOperation, userOpHash, 1000000000000000000n),
        ).to.be.equal(1);
    });

    it.skip("can execute a transaction coming from the entrypoint", async () => {
        const { signers, safe, safeWithPluginInterface, entryPoint } = await hardhatNetworkSetup();
        const randomAddress = hre.ethers.hexlify(hre.ethers.randomBytes(20));
        const oneEther = 10n ** 18n;
        await signers[0].sendTransaction({ to: safe, value: oneEther });

        await safeWithPluginInterface.connect(entryPoint).execTransaction(safe, randomAddress, oneEther, "0x");

        expect(await hre.ethers.provider.getBalance(randomAddress)).to.be.eq(oneEther);
    });

    it.skip("rejects validation requests coming from an address that is not the entrypoint", async () => {
        const { erc4337Plugin, signers, safe, safeWithPluginInterface } = await hardhatNetworkSetup();

        const userOperation: UserOperation = {
            initCode: "0x",
            sender: await safe.getAddress(),
            nonce: 0,
            callData: "0x",
            callGasLimit: 0,
            verificationGasLimit: 0,
            preVerificationGas: 0,
            maxFeePerGas: 0,
            maxPriorityFeePerGas: 0,
            paymasterAndData: "0x",
            signature: "0x",
        };
        const userOpHash = await getUserOpHash(
            userOperation,
            await erc4337Plugin.getAddress(),
            await hre.ethers.provider.getNetwork().then((n) => n.chainId),
        );

        const signature = await signers[0].signMessage(ethers.getBytes(userOpHash));
        userOperation.signature = `0x${(BigInt(signature) + 4n).toString(16)}`;

        // prefund safe
        await signers[0].sendTransaction({ to: safe, value: 1000000000000000000n });

        await expect(
            safeWithPluginInterface.connect(signers[0]).validateUserOp.staticCall(userOperation, userOpHash, 1000000000000000000n),
        ).to.be.revertedWith("Only entrypoint");
    });

    it.skip("rejects execution requests coming from an address that is not the entrypoint", async () => {
        const { signers, safe, safeWithPluginInterface } = await hardhatNetworkSetup();
        const randomAddress = hre.ethers.hexlify(hre.ethers.randomBytes(20));
        const oneEther = 10n ** 18n;
        await signers[0].sendTransaction({ to: safe, value: oneEther });

        await expect(safeWithPluginInterface.connect(signers[0]).execTransaction(safe, randomAddress, oneEther, "0x")).to.be.revertedWith(
            "Only entrypoint",
        );
    });

    itif("integration test - hashes generated by getUserOpHash should match entrypoint hash", async () => {
        const bundlerProvider = new JsonRpcProvider(BUNDLER_URL, undefined, { batchMaxCount: 1 });
        const provider = new hre.ethers.JsonRpcProvider(NODE_URL);

        const entryPoints = await bundlerProvider.send("eth_supportedEntryPoints", []);
        if (entryPoints.length === 0) {
            throw new Error("No entry points found");
        }
        let entryPoint = await ethers.getContractAt("IEntryPoint", entryPoints[0]);
        entryPoint = entryPoint.connect(provider);

        const getRandomHexBytes = (size: number) => {
            return hre.ethers.hexlify(hre.ethers.randomBytes(size));
        };

        const userOperation: UserOperation = {
            initCode: getRandomHexBytes(128),
            sender: getRandomHexBytes(20),
            nonce: 0,
            callData: getRandomHexBytes(128),
            callGasLimit: 25000,
            verificationGasLimit: 100000,
            preVerificationGas: 100000,
            maxFeePerGas: 500000,
            maxPriorityFeePerGas: 50000,
            paymasterAndData: getRandomHexBytes(128),
            signature: getRandomHexBytes(65),
        };

        const userOpHash = await getUserOpHash(
            userOperation,
            await entryPoint.getAddress(),
            await provider.getNetwork().then((n) => n.chainId),
        );

        const entryPointUserOpHash = await entryPoint.getUserOpHash(userOperation);

        expect(userOpHash).to.be.eq(entryPointUserOpHash);
    });

    /**
     * This test verifies the ERC4337 based on gas estimation for a user operation
     * The user operation deploys a Safe with the ERC4337 module and a handler
     * and executes a transaction, thus verifying two things:
     * 1. Deployment of the Safe with the ERC4337 module and handler is possible
     * 2. Executing a transaction is possible
     */
    itif("integration test - it deploys a wallet and executes a user operation", async () => {
        const { erc4337Plugin, safeProxyFactory, safeSingleton, wallet, entryPoint, provider, bundlerProvider } =
            await integrationTestSetup();
        console.log(`Successfully set up test environment.`);
        const feeData = await provider.getFeeData();
        if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
            throw new Error("Could not get fee data");
        }

        const maxFeePerGas = `0x${feeData.maxFeePerGas?.toString(16)}`;
        const maxPriorityFeePerGas = `0x${feeData.maxPriorityFeePerGas?.toString(16)}`;

        const initializer = safeSingleton.interface.encodeFunctionData("setup", [
            [await wallet.getAddress()],
            1,
            await erc4337Plugin.getAddress(),
            erc4337Plugin.interface.encodeFunctionData("enableSafeCoreProtocolWith4337Plugin"),
            ZeroAddress,
            ZeroAddress,
            0,
            ZeroAddress,
        ]);
        console.log(`Obtaining safe address...`);
        const safeAddress = await safeProxyFactory.createProxyWithNonce.staticCall(await safeSingleton.getAddress(), initializer, 73);
        console.log({ safeAddress });

        const initCode =
            (await safeProxyFactory.getAddress()) +
            safeProxyFactory.interface
                .encodeFunctionData("createProxyWithNonce", [await safeSingleton.getAddress(), initializer, 73])
                .slice(2);

        const userOperation: UserOperation = {
            initCode,
            sender: safeAddress,
            nonce: 0,
            callData: "0x",
            callGasLimit: 5000000,
            verificationGasLimit: 700000,
            preVerificationGas: 500000,
            maxFeePerGas,
            maxPriorityFeePerGas,
            paymasterAndData: "0x",
            signature: "0x",
        };
        const userOpHash = await getUserOpHash(
            userOperation,
            await entryPoint.getAddress(),
            await provider.getNetwork().then((n) => n.chainId),
        );
        const userOpHashFromEntryPoint = await entryPoint.getUserOpHash(userOperation);
        console.log({ userOpHash, userOpHashFromEntryPoint });
        const signature = await wallet.signMessage(ethers.getBytes(userOpHash));
        console.log({ signature });
        userOperation.signature = `0x${(BigInt(signature) + 4n).toString(16)}`;

        // Native tokens for the pre-fund 💸 if needed
        if ((await provider.getBalance(safeAddress)) < hre.ethers.parseEther("0.05")) {
            console.log("Sending native tokens to safeAddress");
            await wallet.sendTransaction({ to: safeAddress, value: hre.ethers.parseEther("0.05") }).then((tx) => tx.wait(1));
            // The bundler uses a different node, so we need to allow it sometime to sync
            await sleep(20000);
        }

        // await addAccountDepositExternally(entryPoint, safeAddress, hre.ethers.parseEther("0.005").toString());

        // const asdf = erc4337Plugin.interface.encodeFunctionData("validateUserOp", [userOperation, userOpHash, 0]);
        // console.log(asdf);
        // console.log(userOperation.callData);

        const operation = await bundlerProvider.send("eth_sendUserOperation", [userOperation, await entryPoint.getAddress()]);
        console.log({ operation });
    }).timeout(100000);

    it.skip("test", async () => {
        const { erc4337Plugin, safeProxyFactory, safeSingleton, wallet, entryPoint, provider, bundlerProvider } =
            await integrationTestSetup();
        await wallet.sendTransaction({
            to: safeProxyFactory.target,
            data: "0x1688f0b900000000000000000000000041675c099f32341bf84bfc5382af534df5c7461a000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000490000000000000000000000000000000000000000000000000000000000000184b63e800d0000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000100000000000000000000000008561715b3b71cbcca4967e8efeccd4b1f9c3fac0000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000007bae51c66fd8fa963702d3f0e561c388849674230000000000000000000000000000000000000000000000000000000000000004b005de5b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        });
    });

    it.skip("test", async () => {
        console.log("test");
        const address = "0x3CE5D50834a3Bf8281BA0D41ad4eB859c1CE6aE0";
        const slot = "0x04";
        const key = "0x3a871cdd";

        const paddedAddress = hre.ethers.zeroPadValue(address, 32);
        const paddedSlot = hre.ethers.zeroPadValue(slot, 32);
        const paddedKey = hre.ethers.zeroPadValue(key, 32);

        const concatenated1 = hre.ethers.concat([paddedKey, paddedSlot]);
        const hash1 = hre.ethers.keccak256(concatenated1);

        const concatenated = hre.ethers.concat([paddedAddress, hash1]);
        const hash = hre.ethers.keccak256(concatenated);

        console.log("slot:", hash);
    });
});
