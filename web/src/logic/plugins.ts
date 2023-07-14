import { EventLog } from "ethers";
import { PluginMetadata, loadPluginMetadata } from "./metadata";
import { getPlugin, getRegistry } from "./protocol";

export const loadPluginDetails = async(pluginAddress: string): Promise<PluginMetadata> => {
    const plugin = await getPlugin(pluginAddress)
    const metadata = loadPluginMetadata(plugin)
    return metadata
}

export const loadPlugins = async(filterFlagged: boolean = true): Promise<string[]> => {
    const registry = await getRegistry()
    const addedEvents = (await registry.queryFilter(registry.filters.IntegrationAdded)) as EventLog[]
    const addedIntegrations = addedEvents.map((event: EventLog) => event.args.integration)
    if (!filterFlagged) return addedIntegrations;
    const flaggedEvents = (await registry.queryFilter(registry.filters.IntegrationFlagged)) as EventLog[]
    const flaggedIntegrations = flaggedEvents.map((event: EventLog) => event.args.integration)
    return addedIntegrations.filter((integration) => flaggedIntegrations.indexOf(integration) < 0)
}