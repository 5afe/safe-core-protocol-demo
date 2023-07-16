import { ethers } from "ethers"
import { getProvider } from "./web3";
import { BaseTransaction } from '@safe-global/safe-apps-sdk';

const SAFE_ABI = [
    "function isModuleEnabled(address module) public view returns (bool)",
    "function enableModule(address module) public"
]

// TODO: use safe-core-sdk here
const getSafe = async(address: string) => {
    const provider = await getProvider()
    return new ethers.Contract(
        address,
        SAFE_ABI,
        provider
    )
}

export const isModuleEnabled = async(safeAddress: string, module: string): Promise<boolean> => {
    const safe = await getSafe(safeAddress)
    return await safe.isModuleEnabled(module)
} 

export const buildEnableModule = async(safeAddress: string, module: string): Promise<BaseTransaction> => {
    const safe = await getSafe(safeAddress)
    return {
        to: safeAddress,
        value: "0",
        data: (await safe.enableModule.populateTransaction(module)).data
    }
} 