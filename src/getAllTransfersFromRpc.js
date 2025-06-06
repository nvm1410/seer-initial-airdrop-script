import ethers from 'ethers';
import { RPC_URLS, START_BLOCK } from './constants.js';



const abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const blockChunkSize = 100000;
export async function getAllTransfersOfTokenFromRpc(tokenAddress, chainId) {
    const providerUrl = RPC_URLS[chainId]
    const fromBlock = START_BLOCK[chainId]
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    const latestBlock = await provider.getBlockNumber();

    let allTransfers = [];

    const filter = contract.filters.Transfer();

    for (let startBlock = fromBlock; startBlock <= latestBlock; startBlock += blockChunkSize) {
        const endBlock = Math.min(startBlock + blockChunkSize - 1, latestBlock);

        // Query Transfer events for the current chunk
        const logs = await contract.queryFilter(filter, startBlock, endBlock);

        // Parse logs and add to the transfers array
        const chunkTransfers = logs.map(log => ({
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            from: log.args.from,
            to: log.args.to,
            value: ethers.utils.formatUnits(log.args.value, 18)
        }));

        allTransfers = allTransfers.concat(chunkTransfers);
    }
    return allTransfers
}
