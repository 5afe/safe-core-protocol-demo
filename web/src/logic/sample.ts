import { ethers, getAddress, ZeroAddress } from "ethers"
import { getProvider } from "./web3";
import { GelatoRelay } from "@gelatonetwork/relay-sdk"
import { submitTxs } from "./safeapp";
import { getManager } from "./protocol";

const gelato = new GelatoRelay()

const SAMPLE_PLUGIN_CHAIN_ID = 5
const SAMPLE_PLUGIN_ADDRESS = getAddress("0xA68799b8f1F2535ba88530FeD2300cFC69D4ABd1")
const NATIVE_TOKEN = getAddress("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
const SAMPLE_PLUGIN_ABI = [
    "function maxFeePerToken(address account, address token) public view returns (uint256 maxFee)",
    "function setMaxFeePerToken(address token, uint256 maxFee) external",
    "function executeFromPlugin(address manager, address safe, bytes calldata data) external"
]
const ECR20_ABI = [
    "function decimals() public view returns (uint256 decimals)",
    "function symbol() public view returns (string symbol)",
]

export interface TokenInfo {
    address: string,
    symbol: string, 
    decimals: bigint 
}

export const isKnownSamplePlugin = (chainId: number, address: string): boolean => 
    ethers.toBigInt(chainId) == ethers.toBigInt(SAMPLE_PLUGIN_CHAIN_ID) &&
    getAddress(address) === SAMPLE_PLUGIN_ADDRESS  

const getSamplePlugin = async() => {
    const provider = await getProvider()
    return new ethers.Contract(
        SAMPLE_PLUGIN_ADDRESS,
        SAMPLE_PLUGIN_ABI,
        provider
    )
}

//0x6a7612020000000000000000000000007fae68e71edfd9af429f3c01e75bb905c79e10b70000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000001083a997a822fed50aaaf785f95e2726440069e400000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000415c98c6a811a20f7b34a48b43cdad9d9901443de42e92f736abcc8a7f9e2ee7560550844cdf6e548a9a8b7ee7a0851d7cdc9356545ba345a3231ec5eb564cb7311b00000000000000000000000000000000000000000000000000000000000000

const getToken = async(address: string) => {
    const provider = await getProvider()
    return new ethers.Contract(
        address,
        ECR20_ABI,
        provider
    )
}

export const getAvailableFeeToken = async(): Promise<string[]> => {
    return await gelato.getPaymentTokens(SAMPLE_PLUGIN_CHAIN_ID)
}

export const getMaxFeePerToken = async(account: string, token: string): Promise<bigint> => {
    const plugin = await getSamplePlugin()
    return await plugin.maxFeePerToken(account, token)
}

export const updateMaxFeePerToken = async(token: string, maxFee: bigint) => {
    try {
        const plugin = await getSamplePlugin()
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
        const plugin = await getSamplePlugin()
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
        const response = await gelato.getTaskStatus(taskId)
        console.log(response)
    } catch (e) {
        console.error(e)
    }
}