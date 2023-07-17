// TODO: switch to api-kit once Ethers v6 is supported
import { getAddress, BigNumberish } from "ethers"
import axios from "axios";

export type Page<T> = {
    readonly count: number
    readonly next?: string
    readonly previous?: string
    readonly results: T[]
}

export type SafeMultisigConfirmation = {
    readonly owner: string
    readonly submissionDate: string
    readonly transactionHash?: string
    readonly confirmationType?: string
    readonly signature: string
    readonly signatureType?: string
}

export type SafeMultisigTransaction = {
    readonly safe: string
    readonly to: string
    readonly value: string
    readonly data?: string
    readonly operation: number
    readonly gasToken: string
    readonly safeTxGas: number
    readonly baseGas: number
    readonly gasPrice: string
    readonly refundReceiver?: string
    readonly nonce: number
    readonly executionDate: string
    readonly submissionDate: string
    readonly modified: string
    readonly blockNumber?: number
    readonly transactionHash: string
    readonly safeTxHash: string
    readonly executor?: string
    readonly isExecuted: boolean
    readonly isSuccessful?: boolean
    readonly ethGasPrice?: string
    readonly gasUsed?: number
    readonly fee?: string
    readonly origin: string
    readonly dataDecoded?: string
    readonly confirmationsRequired: number
    readonly confirmations?: SafeMultisigConfirmation[]
    readonly trusted: boolean
    readonly signatures?: string
}


const SAFE_TX_SERVISAFE_TX_SERVICE_BASECE_BASE = "https://safe-transaction-goerli.safe.global/api/"  

const multisigTxsEndpoint = (safe: string) => {
    return SAFE_TX_SERVISAFE_TX_SERVICE_BASECE_BASE + `v1/safes/${getAddress(safe)}/multisig-transactions/`
}

export const getSafeMultisigTxs = async (safe: string, params?: { nonce: BigNumberish }): Promise<Page<SafeMultisigTransaction>> => {
    const response = await axios.get<Page<SafeMultisigTransaction>>(multisigTxsEndpoint(safe), { params })
    return response.data
}