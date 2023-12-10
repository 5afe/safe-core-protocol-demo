import hre, { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getRelayPlugin } from "./utils/contracts";
import { loadPluginMetadata } from "../src/utils/metadata";
import { getProtocolManagerAddress } from "../src/utils/protocol";
import { Interface, MaxUint256, ZeroAddress, ZeroHash, getAddress, keccak256 } from "ethers";
import { ISafeProtocolManager__factory } from "../typechain-types";