// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;
import {ISafe} from "@safe-global/safe-core-protocol/contracts/interfaces/Accounts.sol";
import {ISafeProtocolManager} from "@safe-global/safe-core-protocol/contracts/interfaces/Manager.sol";
import {SafeTransaction, SafeProtocolAction} from "@safe-global/safe-core-protocol/contracts/DataTypes.sol";
import {BasePluginWithEventMetadata, PluginMetadata} from "./Base.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

contract StoplossPlugin is BasePluginWithEventMetadata {

    struct stopLoss {
        uint256 stopLossLimit;
        address tokenAddress;
        address contractAddress;
        bytes swapTx;
    }

    // safe account => stopLoss
    mapping(address => stopLoss) public stopLossBots;

    event AddStopLoss(address indexed safeAccount, address indexed tokenAddress, address contractAddress, uint256 stopLossLimit);

    constructor()
        BasePluginWithEventMetadata(
            PluginMetadata({name: "Stoploss Plugin", version: "1.0.0", requiresRootAccess: true, iconUrl: "", appUrl: ""})
        )
    {}

    function executeFromPlugin(
        address _safeAddress,
        ISafeProtocolManager manager,
        ISafe safe
    ) external returns (bytes memory data) {
        SafeProtocolAction memory safeProtocolAction = SafeProtocolAction(payable(address(safe)), 0, txData);
        SafeRootAccess memory safeTx = SafeRootAccess(safeProtocolAction, 0, "");
        (data) = manager.executeRootAccess(safe, safeTx);

        emit OwnerReplaced(address(safe), oldOwner, newOwner);
    }

    function addStopLoss(uint256 _stopLossLimit, address _tokenAddress, address _contractAddress, bytes calldata _swapTx) external {
        stopLossBots[msg.sender] = stopLoss(_stopLossLimit, _tokenAddress, _contractAddress, _swapTx);
        emit AddStopLoss(msg.sender, _tokenAddress, _contractAddress, _stopLossLimit);
    }

}