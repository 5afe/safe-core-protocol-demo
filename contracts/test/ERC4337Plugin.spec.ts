import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { AbiCoder, keccak256 } from "ethers";
import { loadPluginMetadata } from "../src/utils/metadata";
import { getProtocolManagerAddress } from "../src/utils/protocol";
import { deploySafe, getSafeProxyFactoryContractFactory, getSafeSingletonContractFactory } from "./utils/safe";
import { ModuleType } from "../src/utils/constants";
import { UserOperation } from "./utils/types";
import { BigNumberish } from "ethers";

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

// const uint8ToBytes32 = (number: number): Buffer => {
//     const bytes = Buffer.alloc(32);
//     bytes.writeUint8(number, 31);
//     return bytes;
// };

function encode(typevalues: Array<{ type: string; val: any }>, forSignature: boolean): string {
    const types = typevalues.map((typevalue) => (typevalue.type === "bytes" && forSignature ? "bytes32" : typevalue.type));
    const values = typevalues.map((typevalue) => (typevalue.type === "bytes" && forSignature ? keccak256(typevalue.val) : typevalue.val));
    return AbiCoder.defaultAbiCoder().encode(types, values);
}

export function packUserOp(op: UserOperation, forSignature = true): string {
    if (forSignature) {
        // lighter signature scheme (must match UserOperation#pack): do encode a zero-length signature, but strip afterwards the appended zero-length value
        const userOpType = {
            components: [
                { type: "address", name: "sender" },
                { type: "uint256", name: "nonce" },
                { type: "bytes", name: "initCode" },
                { type: "bytes", name: "callData" },
                { type: "uint256", name: "callGasLimit" },
                { type: "uint256", name: "verificationGasLimit" },
                { type: "uint256", name: "preVerificationGas" },
                { type: "uint256", name: "maxFeePerGas" },
                { type: "uint256", name: "maxPriorityFeePerGas" },
                { type: "bytes", name: "paymasterAndData" },
                { type: "bytes", name: "signature" },
            ],
            name: "userOp",
            type: "tuple",
        };
        let encoded = AbiCoder.defaultAbiCoder().encode([userOpType as any], [{ ...op, signature: "0x" }]);
        // remove leading word (total length) and trailing word (zero-length signature)
        encoded = "0x" + encoded.slice(66, encoded.length - 64);
        return encoded;
    }
    const typevalues = [
        { type: "address", val: op.sender },
        { type: "uint256", val: op.nonce },
        { type: "bytes", val: op.initCode },
        { type: "bytes", val: op.callData },
        { type: "uint256", val: op.callGasLimit },
        { type: "uint256", val: op.verificationGasLimit },
        { type: "uint256", val: op.preVerificationGas },
        { type: "uint256", val: op.maxFeePerGas },
        { type: "uint256", val: op.maxPriorityFeePerGas },
        { type: "bytes", val: op.paymasterAndData },
    ];
    if (!forSignature) {
        // for the purpose of calculating gas cost, also hash signature
        typevalues.push({ type: "bytes", val: op.signature });
    }
    return encode(typevalues, forSignature);
}

export function getUserOpHash(op: UserOperation, validator: string, chainId: BigNumberish): string {
    const userOpStructHash = keccak256(packUserOp(op, true));
    const enc = AbiCoder.defaultAbiCoder().encode(["bytes32", "address", "uint256"], [userOpStructHash, validator, chainId]);
    return keccak256(enc);
}

describe("ERC4337 Plugin", () => {
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
        const erc4337Plugin = await ethers
            .getContractFactory("ERC4337Plugin")
            .then((factory) => factory.deploy(safeProtocolManager.getAddress(), entryPoint.getAddress()));

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

    it("should be initialized correctly", async () => {
        const { erc4337Plugin } = await hardhatNetworkSetup();
        expect(await erc4337Plugin.name()).to.be.eq("ERC4337 Plugin");
        expect(await erc4337Plugin.version()).to.be.eq("1.0.0");
        expect(await erc4337Plugin.permissions()).to.be.eq(1);
    });

    it("can retrieve metadata for the module", async () => {
        const { erc4337Plugin } = await hardhatNetworkSetup();
        expect(await loadPluginMetadata(hre, erc4337Plugin)).to.be.deep.eq({
            name: "ERC4337 Plugin",
            version: "1.0.0",
            permissions: 1,
            iconUrl: "",
            appUrl: "",
        });
    });

    it.only("can validate a signed user operation and send the prefund", async () => {
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

        const zeroBytes32 = `0x${"0".repeat(64)}`;
        const entryPointBalanceBefore = await hre.ethers.provider.getBalance(entryPoint.address);
        // prefund safe
        await signers[0].sendTransaction({ to: safe, value: 1000000000000000000n });

        const tx = await safeWithPluginInterface.connect(entryPoint).validateUserOp(userOperation, zeroBytes32, 1000000000000000000n);
        const receipt = await tx.wait(1);

        if (!receipt?.gasPrice || !receipt?.gasUsed) throw new Error("Gas price or gas used not found in receipt");

        expect(await hre.ethers.provider.getBalance(entryPoint.address)).to.be.eq(
            entryPointBalanceBefore + 1000000000000000000n - receipt.gasPrice * receipt.gasUsed,
        );
        expect(await hre.ethers.provider.getBalance(safe)).to.be.eq(0);
    });

    it("rejects a signed user operation if the signature is invalid", async () => {});

    it("can execute a transaction coming from the entrypoint", async () => {});

    it("rejects validation requests coming from an address that is not the entrypoint", async () => {});

    it("rejects execution requests coming from an address that is not the entrypoint", async () => {});

    /**
     * This test verifies the ERC4337 based on gas estimation for a user operation
     * The user operation deploys a Safe with the ERC4337 module and a handler
     * and executes a transaction, thus verifying two things:
     * 1. Deployment of the Safe with the ERC4337 module and handler is possible
     * 2. Executing a transaction is possible
     */
    itif("integration test", async () => {});
});
