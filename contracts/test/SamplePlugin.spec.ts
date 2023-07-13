import hre, { deployments } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getSamplePlugin } from "./utils/contracts";
import { loadPluginMetaData } from "./utils/metadata";

describe("SamplePlugin", async () => {
    let user1: SignerWithAddress;

    before(async () => {
        [user1] = await hre.ethers.getSigners();
    });

    const setup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const plugin = await getSamplePlugin();
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

    it("can retrieve meta data for module", async () => {
        const { plugin } = await setup();
        expect(await loadPluginMetaData(plugin)).to.be.deep.eq({
            name: "Sample Plugin",
            version: "1.0.0",
            requiresRootAccess: false,
            iconUrl: "",
            appUrl: "",
        });
    });
});
