import { ethers, getAddress, ZeroAddress } from "ethers"
import { getProvider } from "./web3";
import { GelatoRelay } from "@gelatonetwork/relay-sdk"
import { submitTxs } from "./safeapp";
import { getManager } from "./protocol";
import { getCurrentNonce } from "./safe";
import { getSafeMultisigTxs, SafeMultisigTransaction } from "./services";

const SAMPLE_PLUGIN_CHAIN_ID = 5
const SAMPLE_PLUGIN_ADDRESS = getAddress("0x60D996eF6F281eD4f562537fab84CFE192FF0206")
export const NATIVE_TOKEN = getAddress("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
const SAMPLE_PLUGIN_ABI = [
    "function maxFeePerToken(address account, address token) public view returns (uint256 maxFee)",
    "function setMaxFeePerToken(address token, uint256 maxFee) external",
    "function executeFromPlugin(address manager, address safe, bytes calldata data) external"
]
const ECR20_ABI = [
    "function decimals() public view returns (uint256 decimals)",
    "function symbol() public view returns (string symbol)",
]

const gelato = new GelatoRelay()

export interface TokenInfo {
    address: string,
    symbol: string, 
    decimals: bigint 
}

export const isKnownSamplePlugin = (chainId: number, address: string): boolean => 
    ethers.toBigInt(chainId) == ethers.toBigInt(SAMPLE_PLUGIN_CHAIN_ID) &&
    getAddress(address) === SAMPLE_PLUGIN_ADDRESS  

const getRelayPlugin = async() => {
    const provider = await getProvider()
    return new ethers.Contract(
        SAMPLE_PLUGIN_ADDRESS,
        SAMPLE_PLUGIN_ABI,
        provider
    )
}

const getToken = async(address: string) => {
    const provider = await getProvider()
    return new ethers.Contract(
        address,
        ECR20_ABI,
        provider
    )
}

export const getNextTxs = async(safe: string): Promise<SafeMultisigTransaction[]> => {
    const currentNonce = await getCurrentNonce(safe)
    const { results: txs } = await getSafeMultisigTxs(safe, { nonce: currentNonce })
    return txs
}

export const getAvailableFeeToken = async(): Promise<string[]> => {
    return await gelato.getPaymentTokens(SAMPLE_PLUGIN_CHAIN_ID)
}

export const getMaxFeePerToken = async(account: string, token: string): Promise<bigint> => {
    const plugin = await getRelayPlugin()
    return await plugin.maxFeePerToken(account, token)
}

export const updateMaxFeePerToken = async(token: string, maxFee: bigint) => {
    try {
        const plugin = await getRelayPlugin()
        await submitTxs([
            {
                to: await plugin.getAddress(),
                value: "0",
                data: (await plugin.setMaxFeePerToken.populateTransaction(token, maxFee)).data
            }
        ])
    } catch (e) {
        console.error(e)
    }
}

export const getTokenInfo = async(address: string): Promise<TokenInfo> => {
    if (address === NATIVE_TOKEN || address === ZeroAddress) return {
        address,
        symbol: "ETH",
        decimals: BigInt(18)
    }
    const token = await getToken(address)
    return {
        address,
        symbol: await token.symbol(),
        decimals: await token.decimals()
    } 
}

export const relayTx = async(account: string, data: string, feeToken: string) => {
    try {
        const plugin = await getRelayPlugin()
        const manager = await getManager()
        const request = {
            chainId: SAMPLE_PLUGIN_CHAIN_ID,
            target: await plugin.getAddress(),
            data: (await plugin.executeFromPlugin.populateTransaction(await manager.getAddress(), account, data)).data,
            feeToken,
            isRelayContext: true
        }
        console.log({request})
        const response = await gelato.callWithSyncFee(request)
        console.log(response)
        return response.taskId
    } catch (e) {
        console.error(e)
        return ""
    }
}

export const getStatus = async(taskId: string) => {
    try {
        return await gelato.getTaskStatus(taskId)
    } catch (e) {
        console.error(e)
        return undefined
    }
}