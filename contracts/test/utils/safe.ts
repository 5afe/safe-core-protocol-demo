import { ethers } from 'hardhat'
import { SafeProxyFactory__factory, Safe__factory, Safe, SafeProxyFactory } from '../../typechain-types'
import { AddressLike, ZeroAddress } from 'ethers'

export const getSafeSingletonContractFactory = async (): Promise<Safe__factory> => {
  const safeFactory = await ethers.getContractFactory('Safe')

  return safeFactory
}

export const getSafeProxyFactoryContractFactory = async (): Promise<SafeProxyFactory__factory> => {
  const safeProxyFactoryFactory = await ethers.getContractFactory('SafeProxyFactory')

  return safeProxyFactoryFactory
}

export const getSafeContractAt = async (address: string): Promise<Safe> => {
  const safeSingleton = await ethers.getContractAt('Safe', address)

  return safeSingleton
}

export const deploySafe = async (safeProxyFactory: SafeProxyFactory, safeSingleton: Safe, owners: string[], threshold?: number): Promise<Safe> => {
  const singletonAddress = await safeSingleton.getAddress()
  const initializer = safeSingleton.interface.encodeFunctionData("setup",
    [owners, threshold || owners.length, ZeroAddress, '0x', ZeroAddress, ZeroAddress, 0, ZeroAddress])

  const safeProxyAddress = await safeProxyFactory.createProxyWithNonce.staticCall(singletonAddress, initializer, 73)
  await (await safeProxyFactory.createProxyWithNonce(singletonAddress, initializer, 73)).wait()
  const safe = await getSafeContractAt(safeProxyAddress)

  return safe
}