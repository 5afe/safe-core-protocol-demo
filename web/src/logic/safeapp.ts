
import { ethers } from "ethers"
import SafeAppsSDK, { SafeInfo, BaseTransaction } from '@safe-global/safe-apps-sdk';
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

export const isConnectedToSafe = async() => {
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

export const submitTxs = async(txs: BaseTransaction[]): Promise<string> => {
    const response = await safeAppsSDK.txs.send({ txs })
    return response.safeTxHash
}

export const openSafeApp = async(appUrl: string) => {
    if (!isConnectedToSafe()) return
    const safe = await getSafeInfo()
    const environmentInfo = await safeAppsSDK.safe.getEnvironmentInfo()
    const origin = environmentInfo.origin;
    const chainInfo = await safeAppsSDK.safe.getChainInfo()
    const networkPrefix = chainInfo.shortName
    if (origin?.length) {
        window.open(
            `${origin}/apps/open?safe=${networkPrefix}:${safe.safeAddress}&appUrl=${encodeURIComponent(appUrl)}`,
            '_blank',
        )
    }
}