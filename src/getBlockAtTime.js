import { ethers } from "ethers";

export async function getBlockNumberAtTime(timestamp, parentBlockCache, rpcUrl) {
  // Connect to an Ethereum node (replace with your own provider URL)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const blockCache = parentBlockCache ?? new Map();
  // Get the latest block
  const latestBlock = await provider.getBlock("latest");

  // Binary search to find the block closest to the target timestamp
  let left = 1;
  let right = latestBlock.number;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    let block
    if (blockCache.has(mid)) {
      block = blockCache.get(mid);
    } else {
      block = await provider.getBlock(mid);
      blockCache.set(mid, block);
    }

    if (block.timestamp === timestamp) {
      return block.number;
    }
    if (block.timestamp < timestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Return the closest block number
  return right;
}

export async function getBlockNumbersAtTimes(timestamps, rpcUrl) {
  const blockCache = new Map();
  return await Promise.all(timestamps.map((timestamp) => getBlockNumberAtTime(timestamp, blockCache, rpcUrl)));
}