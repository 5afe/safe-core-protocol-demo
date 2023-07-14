
import { AbstractProvider, ethers } from "ethers"
import SafeAppsSDK, { SafeInfo } from '@safe-global/safe-apps-sdk';
import { SafeAppProvider } from '@safe-global/safe-apps-provider';
import { PROTOCOL_CHAIN_ID } from "./constants";

const safeAppsSDK = new SafeAppsSDK()

const waitAndError = <T>(timeout: number) => new Promise<T>((_,reject) => setTimeout(reject, timeout));

let cachedSafeInfo: SafeInfo | undefined = undefined

export const getSafeInfo = async() => {
    if (cachedSafeInfo != undefined) return cachedSafeInfo
    cachedSafeInfo = await safeAppsSDK.safe.getInfo()
    return cachedSafeInfo;
}

export const isConnectToSafe = async() => {
    try {
        const safeInfo = await Promise.race([
            waitAndError<SafeInfo>(300),
            getSafeInfo()
        ])
        return safeInfo != undefined;
    } catch(e) {
        return false;
    }
}

export const getSafeAppsProvider = async() => {
    const info = await getSafeInfo()
    if (info.chainId != Number(PROTOCOL_CHAIN_ID)) throw Error("Unsupported chain")
    return new ethers.BrowserProvider(new SafeAppProvider(info, safeAppsSDK))
}