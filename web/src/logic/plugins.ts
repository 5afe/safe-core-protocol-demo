import { EventLog } from "ethers";
import { PluginMetaData, loadPluginMetaData } from "./metadata";
import { getPlugin, getRegistry } from "./protocol";

export const loadPluginMeta = async(pluginAddress: string): Promise<PluginMetaData> => {
    const plugin = getPlugin(pluginAddress)
    const metaData = loadPluginMetaData(plugin)
    return metaData
}

export const loadPlugins = async(): Promise<string[]> => {
    const registry = getRegistry()
    const events = (await registry.queryFilter(registry.filters.IntegrationAdded)) as EventLog[]
    return events.map((event: EventLog) => event.args.integration)
}