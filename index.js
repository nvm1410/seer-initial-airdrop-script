import fs from 'fs';
import pLimit from "p-limit";
import { gnosis, mainnet } from 'wagmi/chains';
import { getAllTokens, getTokensByTimestamp } from './src/getAllTokens.js';
import { getAllTransfers, getHoldersAtTimestamp } from './src/getAllTransfers.js';
import { getAllLiquidityEvents, getLiquidityBalancesAtTimestamp } from './src/getLiquidityBalances.js';
import { getPOHVerifiedUsers, isPOHVerifiedUserAtTime } from './src/getPOHVerifiedUsers.js';
import { getPrices } from './src/getPrices.js';
import { getRandomTimestamps, parseToCsv } from './src/utils.js';
import { START_TIME } from './src/constants.js';

// import timestamps from './data/timestamps.json' with {type: 'json'}
// import transfers from './data/transfers.json' with {type: 'json'}
// import liquidityEvents from './data/liquidityEvents.json' with {type: 'json'}
// import processedPrices from './data/processedPrices.json' with {type: 'json'}
// import requests from './data/requests.json' with {type: 'json'}


const SNAPSHOT_COUNT = 30
const BATCH_SIZE = 20

async function getOutcomeTokensValueSnapshots(chainId) {
    try {
        // FETCHING DATA
        // get timestamps
        const timestamps = getRandomTimestamps(START_TIME[chainId], SNAPSHOT_COUNT)
        // get tokens
        const { tokens, markets } = await getAllTokens(chainId)
        const tokensByTimestamp = getTokensByTimestamp(markets, timestamps)
        // get all transfers
        const transfers = await getAllTransfers(chainId)
        // get all liquidity events
        const liquidityEvents = await getAllLiquidityEvents(chainId, tokens)
        // get poh verified users
        const requests = await getPOHVerifiedUsers(chainId)
        // get prices at timestamps
        const limit = pLimit(10);
        const awaitList = []
        const batchCount = Math.ceil(tokens.length / BATCH_SIZE)
        for (const timestamp of timestamps) {
            for (let i = 0; i < batchCount; i++) {
                awaitList.push(limit(() => {
                    return getPrices(tokens.slice(BATCH_SIZE * i, BATCH_SIZE * (i + 1)), timestamp, chainId)
                }))
            }
        }
        const resultsPrices = await Promise.all(awaitList)
        const processedPrices = timestamps.reduce((acc, curr, index) => {
            acc[curr.toString()] = resultsPrices.slice(batchCount * index, batchCount * (index + 1)).reduce((accMapping, currMapping) => ({ ...accMapping, ...currMapping }), {})
            return acc
        }, {})

        // START PROCESSING AIRDROP USERS
        let finalData = []
        for (const timestamp of timestamps) {
            const users = {} // {[userAddress]:{directHolding, indirectHolding, isPOH, timestamp}}
            const holdersAtTimestamp = getHoldersAtTimestamp(transfers, timestamp)
            const liquidityHoldersAtTimestamp = getLiquidityBalancesAtTimestamp(liquidityEvents, timestamp)
            Object.entries(holdersAtTimestamp).map(([holderAddress, tokenBalanceMapping]) => {
                if (!users[holderAddress]) {
                    users[holderAddress] = {}
                }
                users[holderAddress]['directHolding'] = (users[holderAddress]['directHolding'] ?? 0) + Object.entries(tokenBalanceMapping).reduce((acc, [tokenId, tokenBalance]) => {
                    if (!tokensByTimestamp[timestamp.toString()][tokenId]) {
                        return acc
                    }
                    return acc + (processedPrices[timestamp.toString()][tokenId] ?? 0) * tokenBalance
                }, 0)
            })
            Object.entries(liquidityHoldersAtTimestamp).map(([holderAddress, tokenBalanceMapping]) => {
                if (!users[holderAddress]) {
                    users[holderAddress] = {}
                }
                users[holderAddress]['indirectHolding'] = (users[holderAddress]['indirectHolding'] ?? 0) + Object.entries(tokenBalanceMapping).reduce((acc, [tokenId, tokenBalance]) => {
                    if (!tokensByTimestamp[timestamp.toString()][tokenId]) {
                        return acc
                    }
                    return acc + (processedPrices[timestamp.toString()][tokenId] ?? 0) * tokenBalance
                }, 0)
            })
            let total = 0
            let pohTotal = 0
            for (const [holderAddress, holderData] of Object.entries(users)) {
                const totalHoldingPerUser = (holderData.directHolding ?? 0) + (holderData.indirectHolding ?? 0)
                const isPOHUser = isPOHVerifiedUserAtTime(requests, holderAddress, timestamp)
                total += totalHoldingPerUser
                if (isPOHUser) {
                    pohTotal += Math.sqrt(totalHoldingPerUser)
                }
            }
            for (const [holderAddress, holderData] of Object.entries(users)) {
                const totalHoldingPerUser = (holderData.directHolding ?? 0) + (holderData.indirectHolding ?? 0)
                if (totalHoldingPerUser.toLocaleString() !== '0') {
                    const isPOHUser = isPOHVerifiedUserAtTime(requests, holderAddress, timestamp)
                    const shareOfHolding = totalHoldingPerUser / total
                    const shareOfHoldingPoh = isPOHUser ? (Math.sqrt(totalHoldingPerUser) / pohTotal) : 0
                    finalData.push({
                        address: holderAddress,
                        isPOHUser,
                        timestamp,
                        totalHolding: totalHoldingPerUser,
                        directHolding: holderData.directHolding ?? 0,
                        indirectHolding: holderData.indirectHolding ?? 0,
                        shareOfHolding,
                        shareOfHoldingPoh
                    })
                }
            }
        }
        finalData = finalData.sort((a, b) => {
            if (a.timestamp === b.timestamp) {
                return b.totalHolding - a.totalHolding
            }
            return a.timestamp - b.timestamp
        }).map(x => (
            {
                ...x,
                totalHolding: x.totalHolding.toLocaleString(),
                isPOHUser: x.isPOHUser ? 'Yes' : 'No',
                directHolding: x.directHolding.toLocaleString(),
                indirectHolding: x.indirectHolding.toLocaleString(),
                shareOfHolding: (x.shareOfHolding * 100).toFixed(4) + '%',
                shareOfHoldingPoh: x.shareOfHoldingPoh ? (x.shareOfHoldingPoh * 100).toFixed(4) + '%' : '0%'
            }))
        const csv = parseToCsv(
            [
                { key: 'address', title: 'Address' },
                { key: 'isPOHUser', title: 'Is POH User' },
                { key: 'timestamp', title: 'Timestamp' },
                { key: 'directHolding', title: 'Direct Holdings (sDAI)' },
                { key: 'indirectHolding', title: 'Indirect Holdings (sDAI)' },
                { key: 'totalHolding', title: 'Total Holdings (sDAI)' },
                { key: 'shareOfHolding', title: 'Share of Holdings' },
                { key: 'shareOfHoldingPoh', title: 'Share of Holdings (PoH Users)' },
            ], finalData)
        fs.writeFileSync(`./data/csv-${chainId}.csv`, csv)

    } catch (e) {
        console.log(e)
        // fs.writeFileSync('./data/error.json', JSON.stringify(e, null, 4))
    }
}
// getOutcomeTokensValueSnapshots(gnosis.id)
getOutcomeTokensValueSnapshots(mainnet.id)