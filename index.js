import fs from 'fs';
import { getAllTokens, getTokensByTimestamp } from './src/getAllTokens.js';
import { getAllFutarchyTransfers, getAllTransfers, getHoldersAtTimestamp } from './src/getAllTransfers.js';
import { getAllLiquidityEvents, getLiquidityBalancesAtTimestamp } from './src/getLiquidityBalances.js';
import { getPOHVerifiedUsers, isPOHVerifiedUserAtTime } from './src/getPOHVerifiedUsers.js';
import { getPoolHourDatasByTokenPairs } from './src/getPoolHourDatas.js';
import { convertToFinalCSV, getRandomNextDayTimestamp, mergeTokenBalances, convertToSupabaseCSV } from './src/utils.js';
import { getLiquidityBalancesByPositionAtTimestamp, getPositionSnapshotsByTokenPairs } from './src/getLiquidityBalancesByPosition.js';
import { getBunniLpTokensByTokenPairs, getBunniLpTokensTransferEvents, getBunniPositionHoldersAtTimestamp } from './src/getLpTokens.js';
import { getPricesFromJson } from './src/getPrices.js'
import timestamps from './data/timestamps.json' with { type: 'json' };


import liquidityEvents100 from './data/liquidityEvents-100.json' with { type: 'json' };
import markets100 from './data/markets-100.json' with { type: 'json' };
import positionSnapshots1 from './data/positionSnapshots-1.json' with { type: 'json' };
import positionSnapshots100 from './data/positionSnapshots-100.json' with { type: 'json' };
import processedPrices100 from './data/processedPrices-100.json' with { type: 'json' };
import requests100 from './data/requests-100.json' with { type: 'json' };
import transfers100 from './data/transfers-100.json' with { type: 'json' };
import tokens100 from './data/tokens-100.json' with { type: 'json' };


import liquidityEvents1 from './data/liquidityEvents-1.json' with { type: 'json' };
import markets1 from './data/markets-1.json' with { type: 'json' };
import processedPrices1 from './data/processedPrices-1.json' with { type: 'json' };
import requests1 from './data/requests-1.json' with { type: 'json' };
import transfers1 from './data/transfers-1.json' with { type: 'json' };
import tokens1 from './data/tokens-1.json' with { type: 'json' };

import seed from './seed.json' with {type: 'json'}





const SNAPSHOT_COUNT = 30
const BATCH_SIZE = 20
const SEER_PER_DAY = 200000000 / 30

const startTimeBlog = 1728579600
const finalSeedDay = Math.floor(Date.now() / 1000)

async function getTimestamps() {
    // FETCHING DATA
    const newTimestamps = [...timestamps]
    // get random timestamps, one for each day
    let nextTimestamp = newTimestamps[newTimestamps.length - 1]
    while ((newTimestamps[newTimestamps.length - 1] ?? 0) < finalSeedDay) {
        nextTimestamp = getRandomNextDayTimestamp(nextTimestamp, finalSeedDay)
        console.log(nextTimestamp)
        if (!nextTimestamp) {
            break
        }
        newTimestamps.push(nextTimestamp)
    }
    newTimestamps.sort((a, b) => a - b)
    // check
    if (newTimestamps.length !== new Set(newTimestamps).size) {
        throw ('duplicate timestamps')
    }
    fs.writeFileSync(`./data/timestamps.json`, JSON.stringify(newTimestamps, null, 4))
    return
}

async function getSeedData(chainId) {
    // GET SEED DATA (first run)
    // get tokens
    const { tokens, markets } = await getAllTokens(chainId)
    console.log(markets.filter(x => x.type === 'Futarchy').length)
    fs.writeFileSync(`./data/tokens-${chainId}.json`, JSON.stringify(tokens, null, 4))
    fs.writeFileSync(`./data/markets-${chainId}.json`, JSON.stringify(markets, null, 4))
    // // get all transfers
    const transfers = await getAllTransfers(chainId)
    const futarchyTransfers = await getAllFutarchyTransfers(chainId)
    console.log({ futarchyTransfers: futarchyTransfers.length, transfers: transfers.length })
    const allTransfers = transfers.concat(futarchyTransfers).sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
    console.log({ allTransfers: allTransfers.length })
    fs.writeFileSync(`./data/transfers-${chainId}.json`, JSON.stringify(allTransfers, null, 4))
    // // get all liquidity events
    const liquidityEvents = await getAllLiquidityEvents(chainId, tokens)
    fs.writeFileSync(`./data/liquidityEvents-${chainId}.json`, JSON.stringify(liquidityEvents, null, 4))
    // // get poh verified users
    const requests = await getPOHVerifiedUsers(chainId)
    fs.writeFileSync(`./data/requests-${chainId}.json`, JSON.stringify(requests, null, 4))
    // // get pool hour datas
    await getPoolHourDatasByTokenPairs(chainId, tokens)
    if (chainId === 1) {
        const { tokens: bunniTokens } = await getBunniLpTokensByTokenPairs(chainId, tokens)
        const bunniPositionSnapshots = await getBunniLpTokensTransferEvents(bunniTokens)
        fs.writeFileSync('./data/positionSnapshots-1.json', JSON.stringify(bunniPositionSnapshots, null, 4))
    } else {
        await getPositionSnapshotsByTokenPairs(chainId, tokens)
    }

}

function getProcessedPrices(chainId) {
    // // get prices at timestamps (second run)
    const processedPrices = timestamps.reduce((acc, timestamp) => {
        acc[timestamp.toString()] = getPricesFromJson(chainId === 1 ? tokens1 : tokens100, timestamp, chainId)
        return acc
    }, {})
    fs.writeFileSync(`./data/processedPrices-${chainId}.json`, JSON.stringify(processedPrices, null, 4))
}
async function test(chainId) {
    console.log(seed.length)
    const csv = convertToSupabaseCSV(seed)
    fs.writeFileSync('./seed.csv', csv)
    // const data = getPricesFromJson(tokens100, 1748995214, chainId)
    // //1752105633
    // const result = Object.entries(data)
    //     .filter(([key, value]) => value > 0)
    //     .sort((a, b) => a[0].localeCompare(b[0]))
    //     .map((x) => x[1])
    //     .join("");
    // console.log(result)
}

test()
// getProcessedPrices(100)
// distributeAirdrop()

function getSeedOutcomeTokensValueSnapshots(chainId) {
    try {

        // USE SEED DATA
        const transfers = chainId === 1 ? transfers1 : transfers100
        const liquidityEvents = chainId === 1 ? liquidityEvents1 : liquidityEvents100
        const markets = chainId === 1 ? markets1 : markets100
        const tokensByTimestamp = getTokensByTimestamp(markets, timestamps)
        const positionSnapshots = chainId === 1 ? positionSnapshots1 : positionSnapshots100
        const processedPrices = chainId === 1 ? processedPrices1 : processedPrices100

        // // START PROCESSING AIRDROP USERS
        let finalData = {}
        for (const timestamp of timestamps) {
            // if (timestamp !== 1752451211) {
            //     continue
            // }
            const users = {} // {[userAddress]:{directHolding, indirectHolding}}
            const holdersAtTimestamp = getHoldersAtTimestamp(transfers, timestamp)
            let liquidityHoldersAtTimestamp
            if (chainId === 100) {
                liquidityHoldersAtTimestamp = getLiquidityBalancesByPositionAtTimestamp(positionSnapshots, timestamp)
            } else {
                liquidityHoldersAtTimestamp = mergeTokenBalances(getLiquidityBalancesAtTimestamp(liquidityEvents, timestamp), getBunniPositionHoldersAtTimestamp(positionSnapshots1, timestamp))
            }
            Object.entries(holdersAtTimestamp).map(([holderAddress, tokenBalanceMapping]) => {
                if (!users[holderAddress]) {
                    users[holderAddress] = {
                        chainId
                    }
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
                    users[holderAddress] = {
                        chainId
                    }
                }
                users[holderAddress]['indirectHolding'] = (users[holderAddress]['indirectHolding'] ?? 0) + Object.entries(tokenBalanceMapping).reduce((acc, [tokenId, tokenBalance]) => {
                    if (!tokensByTimestamp[timestamp.toString()][tokenId]) {
                        return acc
                    }
                    return acc + (processedPrices[timestamp.toString()][tokenId] ?? 0) * tokenBalance
                }, 0)

            })
            finalData[timestamp.toString()] = users
        }
        return finalData

    } catch (e) {
        console.log(e)
        throw (e)
    }
}

async function distributeAirdrop() {
    // {[userAddress]:{directHolding, indirectHolding}}
    const timestampToUsers1 = getSeedOutcomeTokensValueSnapshots(1, false)
    const timestampToUsers100 = getSeedOutcomeTokensValueSnapshots(100, false)
    const finalData = []
    for (const timestamp of timestamps) {
        const userHoldingsAcrossChains = {}
        let total = 0
        let pohTotal = 0
        for (const timestampToUsers of [timestampToUsers1, timestampToUsers100]) {
            for (const [holderAddress, holderData] of Object.entries(timestampToUsers[timestamp.toString()])) {
                if (!userHoldingsAcrossChains[holderAddress]) {
                    userHoldingsAcrossChains[holderAddress] = { directHolding: 0, indirectHolding: 0, chainIds: new Set() }
                }
                const totalHoldingPerUser = (holderData.directHolding ?? 0) + (holderData.indirectHolding ?? 0)
                const isPOHUser = isPOHVerifiedUserAtTime(requests1, holderAddress, timestamp) || isPOHVerifiedUserAtTime(requests100, holderAddress, timestamp)
                total += totalHoldingPerUser
                if (isPOHUser) {
                    pohTotal += Math.sqrt(totalHoldingPerUser)
                }
                userHoldingsAcrossChains[holderAddress].directHolding += (holderData.directHolding ?? 0)
                userHoldingsAcrossChains[holderAddress].indirectHolding += (holderData.indirectHolding ?? 0)
                userHoldingsAcrossChains[holderAddress].chainIds.add(holderData.chainId);
            }
        }
        for (const [holderAddress, holderData] of Object.entries(userHoldingsAcrossChains)) {
            const totalHoldingPerUser = (holderData.directHolding ?? 0) + (holderData.indirectHolding ?? 0)

            if (totalHoldingPerUser.toLocaleString() !== '0') {
                const isPOHUser = isPOHVerifiedUserAtTime(requests1, holderAddress, timestamp) || isPOHVerifiedUserAtTime(requests100, holderAddress, timestamp)
                const shareOfHolding = totalHoldingPerUser / total
                const shareOfHoldingPoh = isPOHUser ? (Math.sqrt(totalHoldingPerUser) / pohTotal) : 0
                const seerTokens = SEER_PER_DAY * (shareOfHolding * 0.25 + shareOfHoldingPoh * 0.25);
                finalData.push({
                    address: holderAddress,
                    isPOHUser,
                    timestamp,
                    totalHolding: totalHoldingPerUser,
                    directHolding: holderData.directHolding ?? 0,
                    indirectHolding: holderData.indirectHolding ?? 0,
                    shareOfHolding,
                    shareOfHoldingPoh,
                    seerTokens,
                    chainIds: Array.from(holderData.chainIds),
                })
            }
        }
    }
    fs.writeFileSync('seed.json', JSON.stringify(finalData, null, 4))
}

async function exportCsv() {
    const csv = convertToFinalCSV(seed)
    fs.writeFileSync('./final.csv', csv)
}