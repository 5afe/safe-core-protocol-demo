import { AbstractProvider, ethers } from "ethers"
import { getSafeAppsProvider, isConnectToSafe } from "./safeapp"
import { PROTOCOL_PUBLIC_RPC } from "./constants"

export const getProvider = async(): Promise<AbstractProvider> => {
    if (await isConnectToSafe()) {
        console.log("Use SafeAppsProvider")
        return await getSafeAppsProvider()
    }
    console.log("Use JsonRpcProvider")
    return new ethers.JsonRpcProvider(PROTOCOL_PUBLIC_RPC)
}