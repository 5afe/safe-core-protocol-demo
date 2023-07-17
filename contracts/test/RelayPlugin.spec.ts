import hre, { deployments } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getRelayPlugin } from "../src/utils/contracts";
import { loadPluginMetadata } from "../src/utils/metadata";

describe("SamplePlugin", async () => {
    let relayer: SignerWithAddress;

    before(async () => {
        [relayer] = await hre.ethers.getSigners();
        console.log("Relayer: ", relayer.address);
    });

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const plugin = await getRelayPlugin(hre);
        return {
            plugin,
        };
    });

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
});
