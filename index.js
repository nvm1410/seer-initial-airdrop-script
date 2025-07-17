import fs from 'fs';
import pLimit from "p-limit";
import { getAllTokens, getTokensByTimestamp } from './src/getAllTokens.js';
import { getAllTransfers, getHoldersAtTimestamp } from './src/getAllTransfers.js';
import { getAllLiquidityEvents, getLiquidityBalancesAtTimestamp } from './src/getLiquidityBalances.js';
import { getPOHVerifiedUsers, isPOHVerifiedUserAtTime } from './src/getPOHVerifiedUsers.js';
import { getPrices, getPricesFromJson } from './src/getPrices.js';
import { getRandomNextDayTimestamp, getRandomTimestamps, parseToCsv, isTwoStringsEqual, convertToFinalCSV } from './src/utils.js';
import { START_TIME } from './src/constants.js';
import { getPoolHourDatas, getPoolHourDatasByTokenPairs } from './src/getPoolHourDatas.js';
import { zeroAddress } from "viem";

import timestamps from './data/timestamps.json' with {type: 'json'}
import markets100 from './data/markets-100.json' with {type: 'json'}
import transfers100 from './data/transfers-100.json' with {type: 'json'}
import liquidityEvents100 from './data/liquidityEvents-100.json' with {type: 'json'}
import positionSnapshots100 from './data/positionSnapshots-100.json' with {type: 'json'}
import positionSnapshots1 from './data/positionSnapshots-1.json' with {type: 'json'}
import requests100 from './data/requests-100.json' with {type: 'json'}
import tokens100 from './data/tokens-100.json' with {type: 'json'}
import processedPrices100 from './data/processedPrices-100.json' with {type: 'json'}


import markets1 from './data/markets-1.json' with {type: 'json'}
import transfers1 from './data/transfers-1.json' with {type: 'json'}
import liquidityEvents1 from './data/liquidityEvents-1.json' with {type: 'json'}
import requests1 from './data/requests-1.json' with {type: 'json'}
import tokens1 from './data/tokens-1.json' with {type: 'json'}
import { getAllPositionSnapshots, getLiquidityBalancesByPositionAtTimestamp, getPositionSnapshotsByTokenPairs } from './src/getLiquidityBalancesByPosition.js';
import { getAllTransfersOfTokenFromRpc } from './src/getAllTransfersFromRpc.js';
import processedPrices1 from './data/processedPrices-1.json' with {type: 'json'}

import seed100 from './data/seed-100.json' with {type: 'json'}
import seedTest100 from './data/seed-test-100.json' with {type: 'json'}
import seed1 from './data/seed-1.json' with {type: 'json'}
import seedTest1 from './data/seed-test-1.json' with {type: 'json'}
import bunniTokens1 from './data/bunniTokens-1.json' with {type: 'json'}
import bunniPoolHourDatas from './data/bunniPoolHourDatas.json' with {type: 'json'}
import bunniSupplySnapshots from './data/bunniSupplySnapshot.json' with {type: 'json'}
import bunniTokenDatas from './data/bunniTokenDatas.json' with {type: 'json'}
import bunniTransfers from './data/bunniTransfers.json' with {type: 'json'}
import bunniGauges from './data/bunniGauges.json' with {type: 'json'}
import seed from './seed.json' with {type: 'json'}
import seedResolved from './seed-resolved.json' with {type: 'json'}


const SNAPSHOT_COUNT = 30
const BATCH_SIZE = 20
const SEER_PER_DAY = 200000000 / 30

const startTimeBlog = 1728579600
async function getSeedOutcomeTokensValueSnapshots(chainId, countResolved = false) {

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
        // USE SEED DATA
        const now = Math.floor(Date.now() / 1000)
        const transfers = chainId === 1 ? transfers1 : transfers100
        const liquidityEvents = chainId === 1 ? liquidityEvents1 : liquidityEvents100
        const markets = chainId === 1 ? markets1 : markets100
        const tokenToMarket = markets.reduce(
            (acum, market) => {
                for (let i = 0; i < market.wrappedTokens.length; i++) {
                    const tokenId = market.wrappedTokens[i];
                    acum[tokenId] = { market, tokenIndex: i };
                }
                return acum;
            },
            {},
        );
        const marketIdToMarket = markets.reduce(
            (acum, market) => {
                acum[market.id] = market
                return acum;
            },
            {},
        );
        // const tokens = chainId === 1 ? tokens1 : tokens100
        const tokensByTimestamp = getTokensByTimestamp(markets, timestamps, countResolved)
        // const positionSnapshots = chainId === 1 ? positionSnapshots1 : positionSnapshots100
        const processedPrices = chainId === 1 ? processedPrices1 : processedPrices100
        // // get prices at timestamps
        // const processedPrices = timestamps.reduce((acc, timestamp) => {
        //     acc[timestamp.toString()] = getPricesFromJson(tokens, timestamp, chainId)
        //     return acc
        // }, {})
        // fs.writeFileSync(`./data/processedPrices-${chainId}.json`,JSON.stringify(processedPrices, null, 4))
        // // START PROCESSING AIRDROP USERS
        let finalData = {}
        for (const timestamp of timestamps) {
            const users = {} // {[userAddress]:{directHolding, indirectHolding}}
            const holdersAtTimestamp = getHoldersAtTimestamp(transfers, timestamp)
            const liquidityHoldersAtTimestamp = getLiquidityBalancesAtTimestamp(liquidityEvents, timestamp)
            // const liquidityHoldersAtTimestamp = getLiquidityBalancesByPositionAtTimestamp(positionSnapshots, timestamp)
            // const liquidityHoldersAtTimestamp = getBunniPoolsHoldersAtTimestamp(bunniTransfers, bunniPoolHourDatas, bunniSupplySnapshots, bunniTokenDatas, bunniGauges, timestamp)
            Object.entries(holdersAtTimestamp).map(([holderAddress, tokenBalanceMapping]) => {
                if (!users[holderAddress]) {
                    users[holderAddress] = {}
                }
                users[holderAddress]['directHolding'] = (users[holderAddress]['directHolding'] ?? 0) + Object.entries(tokenBalanceMapping).reduce((acc, [tokenId, tokenBalance]) => {
                    if (!tokensByTimestamp[timestamp.toString()][tokenId]) {
                        return acc
                    }
                    if (countResolved) {
                        const { market, tokenIndex } = tokenToMarket[tokenId]
                        if (Number(market.finalizeTs) <= timestamp && market.payoutReported) {
                            // use redeem price
                            const sumPayout = market.payoutNumerators.reduce((acc, curr) => acc + Number(curr), 0);
                            const payoutPrice = Number(market.payoutNumerators[tokenIndex]) / sumPayout;

                            if (isTwoStringsEqual(market.parentMarket.id, zeroAddress)) {
                                return acc + payoutPrice * tokenBalance;
                            }
                            // check if parent market has finalized
                            const parentMarket = marketIdToMarket[market.parentMarket.id]
                            if (Number(parentMarket.finalizeTs) <= timestamp && parentMarket.payoutReported) {
                                // use redeem price
                                const sumParentPayout = parentMarket.payoutNumerators.reduce((acc, curr) => acc + Number(curr), 0);
                                const parentPayoutPrice =
                                    Number(parentMarket.payoutNumerators[Number(market.parentOutcome)]) / sumParentPayout;
                                return acc + payoutPrice * parentPayoutPrice * tokenBalance;
                            }
                            const parentTokenId = parentMarket.wrappedTokens[Number(market.parentOutcome)]
                            return acc + payoutPrice * (processedPrices[timestamp.toString()][parentTokenId] ?? 0) * tokenBalance;
                        }
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
                    if (countResolved) {
                        const { market, tokenIndex } = tokenToMarket[tokenId]
                        if (Number(market.finalizeTs) <= timestamp && market.payoutReported) {
                            // use redeem price
                            const sumPayout = market.payoutNumerators.reduce((acc, curr) => acc + Number(curr), 0);
                            const payoutPrice = Number(market.payoutNumerators[tokenIndex]) / sumPayout;

                            if (isTwoStringsEqual(market.parentMarket.id, zeroAddress)) {
                                return acc + payoutPrice * tokenBalance;
                            }
                            // check if parent market has finalized
                            const parentMarket = marketIdToMarket[market.parentMarket.id]
                            if (Number(parentMarket.finalizeTs) <= timestamp && parentMarket.payoutReported) {
                                // use redeem price
                                const sumParentPayout = parentMarket.payoutNumerators.reduce((acc, curr) => acc + Number(curr), 0);
                                const parentPayoutPrice =
                                    Number(parentMarket.payoutNumerators[Number(market.parentOutcome)]) / sumParentPayout;
                                return acc + payoutPrice * parentPayoutPrice * tokenBalance;
                            }
                            const parentTokenId = parentMarket.wrappedTokens[Number(market.parentOutcome)]
                            return acc + payoutPrice * (processedPrices[timestamp.toString()][parentTokenId] ?? 0) * tokenBalance;
                        }
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

async function getAll(chainId) {
    const tokens = chainId === 1 ? tokens1 : tokens100
    // await getPoolHourDatasByTokenPairs(chainId, tokens)
    const data = getPricesFromJson(tokens, 1752451211, chainId)
    const final = Object.entries(data).filter(([key, value]) => value > 0).sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]).join('')
    console.log(final)
}
getAll(100)
async function exportCsv() {
    const csv = convertToFinalCSV(seed)
    fs.writeFileSync('./final.csv', csv)
    const csvResolved = convertToFinalCSV(seedResolved)
    fs.writeFileSync('./finalResolved.csv', csvResolved)
}

async function distributeAirdrop() {
    // {[userAddress]:{directHolding, indirectHolding}}
    const timestampToUsers1 = await getSeedOutcomeTokensValueSnapshots(1, false)
    const timestampToUsers100 = await getSeedOutcomeTokensValueSnapshots(100, false)

    const finalData = []
    for (const timestamp of timestamps) {
        const userHoldingsAcrossChains = {}
        let total = 0
        let pohTotal = 0
        for (const timestampToUsers of [timestampToUsers1, timestampToUsers100]) {
            for (const [holderAddress, holderData] of Object.entries(timestampToUsers[timestamp.toString()])) {
                if (!userHoldingsAcrossChains[holderAddress]) {
                    userHoldingsAcrossChains[holderAddress] = { directHolding: 0, indirectHolding: 0 }
                }
                const totalHoldingPerUser = (holderData.directHolding ?? 0) + (holderData.indirectHolding ?? 0)
                const isPOHUser = isPOHVerifiedUserAtTime(requests1, holderAddress, timestamp) || isPOHVerifiedUserAtTime(requests100, holderAddress, timestamp)
                total += totalHoldingPerUser
                if (isPOHUser) {
                    pohTotal += Math.sqrt(totalHoldingPerUser)
                }
                userHoldingsAcrossChains[holderAddress].directHolding += (holderData.directHolding ?? 0)
                userHoldingsAcrossChains[holderAddress].indirectHolding += (holderData.indirectHolding ?? 0)
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
                })
            }
        }
    }
    fs.writeFileSync('seed.json', JSON.stringify(finalData, null, 4))
}

// distributeAirdrop()
// exportCsv()