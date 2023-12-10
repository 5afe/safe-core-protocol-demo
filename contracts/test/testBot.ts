import { Interface } from "@ethersproject/abi";
import { Web3Function, Web3FunctionEventContext } from "@gelatonetwork/web3-functions-sdk";

const NFT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

Web3Function.onRun(async (context: Web3FunctionEventContext) => {
  // Get event log from Web3FunctionEventContext
  const { log } = context;
  
  // Parse your event from ABI
  const nft = new Interface(NFT_ABI);
  const event = nft.parseLog(log);

  // Handle event data
  const { from, to, tokenId } = event.args;
  console.log(`Transfer of NFT #${tokenId} from ${from} to ${to} detected`);
  
  return { canExec: false, message: `Event processed ${log.transactionHash}` };
});