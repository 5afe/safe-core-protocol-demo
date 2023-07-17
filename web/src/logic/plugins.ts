import { ZeroAddress, EventLog } from "ethers";
import { BaseTransaction } from '@safe-global/safe-apps-sdk';
import { PluginMetadata, loadPluginMetadata } from "./metadata";
import { getManager, getPlugin, getRegistry } from "./protocol";
import { getSafeInfo, isConnectedToSafe, submitTxs } from "./safeapp";
import { isModuleEnabled, buildEnableModule } from "./safe";

const SENTINEL_MODULES = "0x0000000000000000000000000000000000000001"

export interface PluginDetails {
    metadata: PluginMetadata,
    enabled?: boolean
}

export const loadPluginDetails = async(pluginAddress: string): Promise<PluginDetails> => {
    const plugin = await getPlugin(pluginAddress)
    const metadata = await loadPluginMetadata(plugin)
    if (!await isConnectedToSafe()) return { metadata }
    const enabled = await isPluginEnabled(pluginAddress)
    return  { metadata, enabled }
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

export const isPluginEnabled = async(plugin: string) => {
    if (!await isConnectedToSafe()) throw Error("Not connected to a Safe")
    const manager = await getManager()
    const safeInfo = await getSafeInfo()
    const pluginInfo = await manager.enabledPlugins(safeInfo.safeAddress, plugin)
    return pluginInfo.nextPluginPointer !== ZeroAddress
}

export const loadEnabledPlugins = async(): Promise<string[]> => {
    if (!await isConnectedToSafe()) throw Error("Not connected to a Safe")
    const manager = await getManager()
    const safeInfo = await getSafeInfo()
    const paginatedPlugins = await manager.getPluginsPaginated(SENTINEL_MODULES, 10, safeInfo.safeAddress)
    return paginatedPlugins.array
}

const buildEnablePlugin = async(plugin: string, requiresRootAccess: boolean): Promise<BaseTransaction> => {
    const manager = await getManager()
    return {
        to: await manager.getAddress(),
        value: "0",
        data: (await manager.enablePlugin.populateTransaction(plugin, requiresRootAccess)).data
    }
} 

export const enablePlugin = async(plugin: string, requiresRootAccess: boolean) => {
    if (!await isConnectedToSafe()) throw Error("Not connected to a Safe")
    const manager = await getManager()
    const managerAddress = await manager.getAddress()
    const info = await getSafeInfo()
    const txs: BaseTransaction[] = []
    if (!await isModuleEnabled(info.safeAddress, managerAddress)) {
        txs.push(await buildEnableModule(info.safeAddress, managerAddress))
    }
    if (!await isPluginEnabled(plugin)) {
        txs.push(await buildEnablePlugin(plugin, requiresRootAccess))
    }
    if (txs.length == 0) return
    await submitTxs(txs)
}

const buildDisablePlugin = async(pointer: string, plugin: string): Promise<BaseTransaction> => {
    const manager = await getManager()
    return {
        to: await manager.getAddress(),
        value: "0",
        data: (await manager.disablePlugin.populateTransaction(pointer, plugin)).data
    }
} 

export const disablePlugin = async(plugin: string) => {
    if (!await isConnectedToSafe()) throw Error("Not connected to a Safe")
    const manager = await getManager()
    const txs: BaseTransaction[] = []
    const enabledPlugins = await loadEnabledPlugins()
    const index = enabledPlugins.indexOf(plugin)
    // Plugin is not enabled
    if (index < 0) return
    // If the plugin is not the first element in the linked list use previous element as pointer
    // Otherwise use sentinel as pointer
    const pointer = index > 0 ? enabledPlugins[index - 1] : SENTINEL_MODULES;
    await submitTxs([await buildDisablePlugin(pointer, plugin)])
}