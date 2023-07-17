import { AbstractProvider, ethers } from "ethers"
import { getSafeAppsProvider, isConnectedToSafe } from "./safeapp"
import { PROTOCOL_PUBLIC_RPC } from "./constants"

export const getProvider = async(): Promise<AbstractProvider> => {
    if (await isConnectedToSafe()) {
        console.log("Use SafeAppsProvider")
        return await getSafeAppsProvider()
    }
    console.log("Use JsonRpcProvider")
    return new ethers.JsonRpcProvider(PROTOCOL_PUBLIC_RPC)
}