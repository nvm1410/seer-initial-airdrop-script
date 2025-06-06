import fs from 'fs';
import pLimit from "p-limit";
import { getAllTokens, getTokensByTimestamp } from './src/getAllTokens.js';
import { getAllTransfers, getHoldersAtTimestamp } from './src/getAllTransfers.js';
import { getAllLiquidityEvents, getLiquidityBalancesAtTimestamp } from './src/getLiquidityBalances.js';
import { getPOHVerifiedUsers, isPOHVerifiedUserAtTime } from './src/getPOHVerifiedUsers.js';
import { getPrices, getPricesFromJson } from './src/getPrices.js';
import { getRandomNextDayTimestamp, getRandomTimestamps, parseToCsv } from './src/utils.js';
import { START_TIME } from './src/constants.js';
import { getPoolHourDatas, getPoolHourDatasByTokenPairs } from './src/getPoolHourDatas.js';

import timestamps from './data/timestamps.json' with {type: 'json'}
import markets100 from './data/markets-100.json' with {type: 'json'}
import transfers100 from './data/transfers-100.json' with {type: 'json'}
import liquidityEvents100 from './data/liquidityEvents-100.json' with {type: 'json'}
import positionSnapshots100 from './data/positionSnapshots-100.json' with {type: 'json'}
import positionSnapshots1 from './data/positionSnapshots-1.json' with {type: 'json'}
import requests100 from './data/requests-100.json' with {type: 'json'}
import tokens100 from './data/tokens-100.json' with {type: 'json'}

import markets1 from './data/markets-1.json' with {type: 'json'}
import transfers1 from './data/transfers-1.json' with {type: 'json'}
import liquidityEvents1 from './data/liquidityEvents-1.json' with {type: 'json'}
import requests1 from './data/requests-1.json' with {type: 'json'}
import tokens1 from './data/tokens-1.json' with {type: 'json'}
import { getAllPositionSnapshots, getLiquidityBalancesByPositionAtTimestamp, getPositionSnapshotsByTokenPairs } from './src/getLiquidityBalancesByPosition.js';
import { getBunniLpTokensByTokenPairs } from './src/getLpTokens.js';
import { getAllTransfersOfTokenFromRpc } from './src/getAllTransfersFromRpc.js';
import processedPrices from './data/processedPrices-100.json' with {type: 'json'}

import seed100 from './data/seed-100.json' with {type: 'json'}
import seedTest100 from './data/seed-test-100.json' with {type: 'json'}


const SNAPSHOT_COUNT = 30
const BATCH_SIZE = 20
const SEER_PER_DAY = 200000000 / 30

const finalSeedDay = 1748131200 //'2025-05-25T00:00:00.000Z'
const startTimeBlog = 1728579600
async function getSeedOutcomeTokensValueSnapshots(chainId) {
    // console.log(seed100.length, seedTest100.length)
    // const diff = []
    // for (let i = 0; i < seed100.length; i++) {
    //     const a = seed100[i]
    //     const b = seedTest100[i]
    //     for (const key of Object.keys(a)) {
    //         if (a[key] !== b[key] && key === 'address') {
    //             diff.push({
    //                 key,
    //                 addressA: a.address,
    //                 valueA: a[key],
    //                 valueB: b[key],
    //                 ...a.address !== b.address && {
    //                     addressB: b.address,
    //                 }
    //             })
    //             // if (Math.abs(a[key] - b[key]) > 1) {
    //             //     diff.push({
    //             //         key,
    //             //         addressA: a.address,
    //             //         valueA: a[key],
    //             //         valueB: b[key],
    //             //         ...a.address !== b.address && {
    //             //             addressB: b.address,
    //             //         }
    //             //     })
    //             // }

    //         }
    //     }
    // }
    // fs.writeFileSync('./data/diff.json', JSON.stringify(diff, null, 4))
    // return
    try {
        // FETCHING DATA
        // get random timestamps, one for each day
        // let timestamps = []
        // let nextTimestamp = startTimeBlog
        // while ((timestamps[timestamps.length - 1] ?? 0) < finalSeedDay) {
        //     nextTimestamp = getRandomNextDayTimestamp(nextTimestamp, finalSeedDay)
        //     console.log(nextTimestamp)
        //     if(!nextTimestamp){
        //         break
        //     }
        //     timestamps.push(nextTimestamp)
        // }
        // timestamps.sort((a, b) => a - b)
        // // check
        // if (timestamps.length !== new Set(timestamps).size) {
        //     throw ('duplicate timestamps')
        // }
        // fs.writeFileSync(`./data/timestamps.json`, JSON.stringify(timestamps, null, 4))
        // get tokens
        // const { tokens, markets } = await getAllTokens(chainId)
        // fs.writeFileSync(`./data/tokens-${chainId}.json`, JSON.stringify(tokens, null, 4))
        // fs.writeFileSync(`./data/markets-${chainId}.json`, JSON.stringify(markets, null, 4))
        // // get all transfers
        // const transfers = await getAllTransfers(chainId)
        // fs.writeFileSync(`./data/transfers-${chainId}.json`, JSON.stringify(transfers, null, 4))
        // // get all liquidity events
        // const liquidityEvents = await getAllLiquidityEvents(chainId, tokens)
        // fs.writeFileSync(`./data/liquidityEvents-${chainId}.json`, JSON.stringify(liquidityEvents, null, 4))
        // // get poh verified users
        // const requests = await getPOHVerifiedUsers(chainId)
        // fs.writeFileSync(`./data/requests-${chainId}.json`, JSON.stringify(requests, null, 4))
        // const positionSnapshots = await getAllPositionSnapshots(chainId, tokens)
        // fs.writeFileSync(`./data/positionSnapshots-${chainId}.json`, JSON.stringify(positionSnapshots, null, 4))
        // USE SEED DATA
        const transfers = chainId === 1 ? transfers1 : transfers100
        const liquidityEvents = chainId === 1 ? liquidityEvents1 : liquidityEvents100
        const requests = chainId === 1 ? requests1 : requests100
        const markets = chainId === 1 ? markets1 : markets100
        const tokens = chainId === 1 ? tokens1 : tokens100
        const tokensByTimestamp = getTokensByTimestamp(markets, timestamps)
        const positionSnapshots = chainId === 1 ? positionSnapshots1 : positionSnapshots100

        // get prices at timestamps
        // const processedPrices = timestamps.reduce((acc, timestamp) => {
        //     acc[timestamp.toString()] = getPricesFromJson(tokens, timestamp, chainId)
        //     return acc
        // }, {})
        // START PROCESSING AIRDROP USERS
        let finalData = []
        for (const timestamp of timestamps) {
            const users = {} // {[userAddress]:{directHolding, indirectHolding, isPOH, timestamp}}
            const holdersAtTimestamp = getHoldersAtTimestamp(transfers, timestamp)
            // const liquidityHoldersAtTimestamp = getLiquidityBalancesAtTimestamp(liquidityEvents, timestamp)
            const liquidityHoldersAtTimestamp = getLiquidityBalancesByPositionAtTimestamp(positionSnapshots, timestamp)
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
                        chainId
                    })
                }
            }
        }


        fs.writeFileSync(`./data/seed-test-${chainId}.json`, JSON.stringify(finalData, null, 4))

    } catch (e) {
        console.log(e)
        // fs.writeFileSync('./data/error.json', JSON.stringify(e, null, 4))
    }
}

async function getAll(chainId) {
    const tokens = [
        "0x37b149404a64638ff73abd98faa8f0cdcd1cf4a4",
        "0x84bd444e0fc068c411a1232b78edaccf0e405256",
        "0xc5fab3ea4beb1e39e85d7ec0c1ef37a4c93adccd",
        "0xac29366413ccb7fa87018b4224fa44e2b6e76ca2",
        "0x381a858af49f646052324c8656353701339f9e76",
        "0xfbdecd21245e44a8dc7f0065c38c437daa4d4240",
        "0xa65b54b9007c29498a68af1cfcfc063e124715f9"
    ]
    let counter = 1
    for (const token of tokens) {
        console.log('start ', token)
        const transfers = await getAllTransfersOfTokenFromRpc(token, chainId)
        fs.writeFileSync(`./data/transfers-rpc-${counter}-${chainId}.json`, JSON.stringify(transfers, null, 4))
        counter++
    }
}
// getAll(1)
getSeedOutcomeTokensValueSnapshots(100)
// getSeedOutcomeTokensValueSnapshots(1)