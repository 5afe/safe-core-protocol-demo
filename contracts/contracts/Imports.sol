// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;

// Import the contract so hardhat compiles it, and we have the ABI available
import {MockContract} from "@safe-global/mock-contract/contracts/MockContract.sol";
import {TestSafeProtocolRegistryUnrestricted} from "@safe-global/safe-core-protocol/contracts/test/TestSafeProtocolRegistryUnrestricted.sol";
import {SafeProtocolManager} from "@safe-global/safe-core-protocol/contracts/SafeProtocolManager.sol";
import {Safe} from "@safe-global/safe-contracts/contracts/Safe.sol";
import {SafeProxyFactory} from "@safe-global/safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "@safe-global/safe-contracts/contracts/proxies/SafeProxy.sol";

// ExecutableMockContract for testing

contract ExecutableMockContract is MockContract {
    function executeCallViaMock(
        address payable to,
        uint256 value,
        bytes memory data,
        uint256 gas
    ) external returns (bool success, bytes memory response) {
        (success, response) = to.call{value: value, gas: gas}(data);
    }
}
