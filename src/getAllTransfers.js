import { SUBGRAPHS } from "./constants.js";
import ethers from 'ethers'

export async function getAllTransfers(chainId) {
    const maxAttempts = 20;
    let attempt = 0;
    let allTransfers = [];
    let currentTimestamp = undefined;
    while (true) {
        const query = `{
              transfers(first: 1000, orderBy: timestamp, orderDirection: asc${currentTimestamp ? `, where: {timestamp_gt: "${currentTimestamp}"}` : ""
            }) {
                id
                from
                to
                token {
                    id
                }
                timestamp
                blockNumber
                value
              }
            }`;
        const results = await fetch(SUBGRAPHS['tokens'][chainId], {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
            }),
        });
        const json = await results.json();
        const transfers = (json?.data?.transfers ?? []);
        allTransfers = allTransfers.concat(transfers);

        if (transfers[transfers.length - 1]?.timestamp === currentTimestamp) {
            break;
        }
        if (transfers.length < 1000) {
            break; // We've fetched all
        }
        currentTimestamp = transfers[transfers.length - 1]?.timestamp;
        attempt++;
    }
    return allTransfers
}

export async function getAllFutarchyTransfers(chainId) {
    if (chainId !== 100) {
        return []
    }
    const maxAttempts = 20;
    let attempt = 0;
    let allTransfers = [];
    let currentTimestamp = undefined;
    while (true) {
        const query = `{
              transfers(first: 1000, orderBy: timestamp, orderDirection: asc${currentTimestamp ? `, where: {timestamp_gt: "${currentTimestamp}"}` : ""
            }) {
                id
                from
                to
                token {
                    id
                }
                timestamp
                blockNumber
                value
              }
            }`;
        const results = await fetch('https://gateway.thegraph.com/api/a3d37662f27d87b20e3d8d7149e85910/subgraphs/id/H8uG6j77JyfwRv31aYfJcFby8eRfXSpbwqiuzPQfCQJD', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
            }),
        });
        const json = await results.json();
        const transfers = (json?.data?.transfers ?? []);
        allTransfers = allTransfers.concat(transfers);

        if (transfers[transfers.length - 1]?.timestamp === currentTimestamp) {
            break;
        }
        if (transfers.length < 1000) {
            break; // We've fetched all
        }
        currentTimestamp = transfers[transfers.length - 1]?.timestamp;
        attempt++;
    }
    return allTransfers
}

export function getHoldersAtTimestamp(allTransfers, timestamp) {
    const records = allTransfers.filter(transfer => Number(transfer.timestamp) <= timestamp)
    const tokenBalances = {};

    // Process each transfer
    for (const transfer of records) {
        const tokenId = transfer.token.id.toLowerCase();
        const from = transfer.from.toLowerCase();
        const to = transfer.to.toLowerCase();
        const value = ethers.BigNumber.from(transfer.value);

        // Initialize token balances if not exists
        if (!tokenBalances[from]) {
            tokenBalances[from] = {};
        }
        if (!tokenBalances[to]) {
            tokenBalances[to] = {};
        }
        tokenBalances[from][tokenId] = (tokenBalances[from][tokenId] || ethers.BigNumber.from(0)).sub(value);
        tokenBalances[to][tokenId] = (tokenBalances[to][tokenId] || ethers.BigNumber.from(0)).add(value);
    }

    const formattedBalances = {};
    for (const [user, balances] of Object.entries(tokenBalances)) {
        // Exclude zero address and non-positive balances
        if (user !== ethers.constants.AddressZero) {
            formattedBalances[user] = {};
            for (const [tokenId, balance] of Object.entries(balances)) {
                if (balance.gt(0)) {
                    formattedBalances[user][tokenId] = Number(ethers.utils.formatUnits(balance, 18))
                }
            }
        }

    }
    return formattedBalances
}