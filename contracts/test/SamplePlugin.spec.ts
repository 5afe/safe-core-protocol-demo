import hre, { deployments } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getSamplePlugin } from "../src/utils/contracts";
import { loadPluginMetadata } from "../src/utils/metadata";

describe("SamplePlugin", async () => {
    let user1: SignerWithAddress;

    before(async () => {
        [user1] = await hre.ethers.getSigners();
    });

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const plugin = await getSamplePlugin(hre);
        return {
            plugin,
        };
    });

    it("should be inititalized correctly", async () => {
        const { plugin } = await setup();
        console.log(user1);
        expect(await plugin.name()).to.be.eq("Sample Plugin");
        expect(await plugin.version()).to.be.eq("1.0.0");
        expect(await plugin.requiresRootAccess()).to.be.false;
    });

    it("can retrieve metadata for module", async () => {
        const { plugin } = await setup();
        expect(await loadPluginMetadata(hre, plugin)).to.be.deep.eq({
            name: "Sample Plugin",
            version: "1.0.0",
            requiresRootAccess: false,
            iconUrl: "",
            appUrl: "",
        });
    });
});
