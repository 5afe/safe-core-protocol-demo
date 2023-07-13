import { AbstractProvider, ethers } from "ethers"

export const getProvider = (): AbstractProvider => {
    return new ethers.JsonRpcProvider("https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161")
}