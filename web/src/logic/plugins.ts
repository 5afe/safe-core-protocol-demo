import { EventLog } from "ethers";
import { PluginMetadata, loadPluginMetadata } from "./metadata";
import { getPlugin, getRegistry } from "./protocol";

export const loadPluginDetails = async(pluginAddress: string): Promise<PluginMetadata> => {
    const plugin = getPlugin(pluginAddress)
    const metadata = loadPluginMetadata(plugin)
    return metadata
}

export const loadPlugins = async(): Promise<string[]> => {
    const registry = getRegistry()
    const events = (await registry.queryFilter(registry.filters.IntegrationAdded)) as EventLog[]
    return events.map((event: EventLog) => event.args.integration)
}