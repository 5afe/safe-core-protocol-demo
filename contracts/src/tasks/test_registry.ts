import "hardhat-deploy";
import "@nomicfoundation/hardhat-ethers";
import { task } from "hardhat/config";
import { getPlugin, getRegistry, getRelayPlugin } from "../utils/contracts";
import { IntegrationType } from "../utils/constants";
import { loadPluginMetadata } from "../utils/metadata";

task("register-plugin", "Registers the sample Plugin in the Safe{Core} test register")
    .setAction(async (_, hre) => {
        const registry = await getRegistry(hre)
        const plugin = await getRelayPlugin(hre)
        await registry.addIntegration(await plugin.getAddress(), IntegrationType.Plugin)
        console.log("Registered Plugin registry")
    });

task("list-plugins", "List available Plugins in the Safe{Core} test register")
    .setAction(async (_, hre) => {
        const registry = await getRegistry(hre)
        const events = await registry.queryFilter(registry.filters.IntegrationAdded)
        for (const event of events) {
            const plugin = await getPlugin(hre, event.args.integration)
            const metadata = await loadPluginMetadata(hre, plugin)
            console.log(event.args.integration, metadata)
        }
    });

export { }