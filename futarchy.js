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
async function getSeedFutarchyValueSnapshots(chainId) {

    try {
        // get tokens + markets
        
        //get all transfers
        //index erc20 in subgraph, then call getAllTransfers()
       
        //get all liquidity events
        //get all token pairs then everything is the same 
      
        // USE SEED DATA
        const now = Math.floor(Date.now() / 1000)
        const transfers = chainId === 1 ? transfers1 : transfers100
        const liquidityEvents = chainId === 1 ? liquidityEvents1 : liquidityEvents100
        const markets = chainId === 1 ? markets1 : markets100
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
        // let finalData = {}
        // for (const timestamp of timestamps) {
        //     const users = {} // {[userAddress]:{directHolding, indirectHolding}}
        //     const holdersAtTimestamp = getHoldersAtTimestamp(transfers, timestamp)
        //     const liquidityHoldersAtTimestamp = getLiquidityBalancesAtTimestamp(liquidityEvents, timestamp)
        //     Object.entries(holdersAtTimestamp).map(([holderAddress, tokenBalanceMapping]) => {
        //         if (!users[holderAddress]) {
        //             users[holderAddress] = {}
        //         }
        //         users[holderAddress]['directHolding'] = (users[holderAddress]['directHolding'] ?? 0) + Object.entries(tokenBalanceMapping).reduce((acc, [tokenId, tokenBalance]) => {
        //             if (!tokensByTimestamp[timestamp.toString()][tokenId]) {
        //                 return acc
        //             }
        //             return acc + (processedPrices[timestamp.toString()][tokenId] ?? 0) * tokenBalance
        //         }, 0)
        //     })
        //     Object.entries(liquidityHoldersAtTimestamp).map(([holderAddress, tokenBalanceMapping]) => {
        //         if (!users[holderAddress]) {
        //             users[holderAddress] = {}
        //         }
        //         users[holderAddress]['indirectHolding'] = (users[holderAddress]['indirectHolding'] ?? 0) + Object.entries(tokenBalanceMapping).reduce((acc, [tokenId, tokenBalance]) => {
        //             if (!tokensByTimestamp[timestamp.toString()][tokenId]) {
        //                 return acc
        //             }
        //             return acc + (processedPrices[timestamp.toString()][tokenId] ?? 0) * tokenBalance
        //         }, 0)

        //     })
        //     finalData[timestamp.toString()] = users
        // }
        // return finalData

    } catch (e) {
        console.log(e)
        throw (e)
    }
}