// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;
import {ISafe} from "@safe-global/safe-core-protocol/contracts/interfaces/Accounts.sol";
import {ISafeProtocolManager} from "@safe-global/safe-core-protocol/contracts/interfaces/Manager.sol";
import {SafeTransaction, SafeProtocolAction} from "@safe-global/safe-core-protocol/contracts/DataTypes.sol";
import {BasePluginWithEventMetadata, PluginMetadata} from "./Base.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

/// @title A safe plugin to implement stopLoss on a certain token in safe
/// @author https://github.com/kalrashivam
/// @notice Creates an event which can be used to create
///         a bot to track price and then trigger safe transaction through plugin.
/// @dev The plugin is made based on the safe-core-demo-template
contract StoplossPlugin is BasePluginWithEventMetadata {

    struct StopLoss {
        uint256 stopLossLimit;
        address tokenAddress;
        address contractAddress;
        SafeTransaction safeSwapTx;
    }

    // safe account => stopLoss
    mapping(address => StopLoss) public Bots;

    /// @notice Listen for this event to create your stop loss bot
    /// @param safeAccount safe account address.
    /// @param tokenAddress token address to apply stoploss on.
    /// @param contractAddress address of the uniswap/cowswap pair to perform transaction on.
    /// @param stopLossLimit the limit after which the swap should be triggered.
    event AddStopLoss(address indexed safeAccount, address indexed tokenAddress, address contractAddress, uint256 stopLossLimit);
    // Listen for this event to remove the bot
    event RemoveStopLoss(address indexed safeAccount, address indexed tokenAddress);

    // raised when the swap on uniswap fails, check for this in the bot.
    error SwapFailure(bytes data);

    constructor()
        BasePluginWithEventMetadata(
            PluginMetadata({name: "Stoploss Plugin", version: "1.0.0", requiresRootAccess: false, iconUrl: "", appUrl: ""})
        )
    {}

    function executeFromPlugin(
        address _safeAddress,
        ISafeProtocolManager manager,
        ISafe safe,
        bytes32 _hashedMessage,
        bytes32 _r,
        bytes32 _s,
        uint8 _v
    ) external {
        verifyMessage(_hashedMessage, _v, _r, _s);
        StopLoss memory stopLossBot = Bots[_safeAddress];

        try manager.executeTransaction(safe, stopLossBot.safeSwapTx) returns (bytes[] memory) {
            delete Bots[_safeAddress];
            emit RemoveStopLoss(_safeAddress, stopLossBot.tokenAddress);
        } catch (bytes memory reason) {
            revert SwapFailure(reason);
        }
    }

    function addStopLoss(uint256 _stopLossLimit, address _tokenAddress, address _contractAddress, SafeTransaction calldata _safeSwapTx) external {
        Bots[msg.sender] = StopLoss(_stopLossLimit, _tokenAddress, _contractAddress, _safeSwapTx);
        emit AddStopLoss(msg.sender, _tokenAddress, _contractAddress, _stopLossLimit);
    }

    function verifyMessage(bytes32 _hashedMessage, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHashMessage = keccak256(abi.encodePacked(prefix, _hashedMessage));
        address signer = ecrecover(prefixedHashMessage, _v, _r, _s);
        return signer;
    }
}
