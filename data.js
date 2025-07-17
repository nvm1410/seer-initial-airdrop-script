import fs from 'fs';
import { getAllTokens } from './src/getAllTokens.js';
import { getAllTransfers, getHoldersAtTimestamp } from './src/getAllTransfers.js';





async function getTopPredictors(chainId) {

    try {

        const { tokens, markets } = await getAllTokens(chainId)
        // get resolved markets
        const resolvedMarkets = markets.filter(market => market.payoutReported && Number(market.finalizeTs) > 0)
        // // get all transfers
        const transfers = await getAllTransfers(chainId)
        const predictorToWinningMarketsMapping = {}
        for (const market of resolvedMarkets) {
            const timestamp = Number(market.finalizeTs)
            const winningTokens = market.wrappedTokens.filter((_, index) => Number(market.payoutNumerators[index]) > 0)
            // check who held the most winning tokens
            const holdersAtTimestamp = getHoldersAtTimestamp(transfers, timestamp)
            Object.entries(holdersAtTimestamp).map(([holderAddress, tokenBalanceMapping]) => {
                if (!predictorToWinningMarketsMapping[holderAddress]) {
                    predictorToWinningMarketsMapping[holderAddress] = []
                }
                const wrappedTokensMapping = market.wrappedTokens.reduce((acc, curr) => {
                    acc[curr] = tokenBalanceMapping[curr] ?? 0
                    return acc
                }, {})

                //make sure they don't hold the same amount of all wrappedTokens (split only)
                const isHolderSplitOnly = new Set(Object.values(wrappedTokensMapping)).size === 1
                if (!isHolderSplitOnly) {
                    //check if the token(s) they held the most is in winning list
                    let mostHeldBalance = Object.values(wrappedTokensMapping)[0]
                    for (let i = 0; i < Object.values(wrappedTokensMapping).length; i++) {
                        if (Object.values(wrappedTokensMapping)[i] > mostHeldBalance) {
                            mostHeldBalance = Object.values(wrappedTokensMapping)[i]
                        }
                    }
                    const mostHeldTokens = Object.keys(wrappedTokensMapping).filter((_, index) => Object.values(wrappedTokensMapping)[index] === mostHeldBalance)
                    if (mostHeldTokens.some(token => winningTokens.includes(token))) {
                        predictorToWinningMarketsMapping[holderAddress].push(market.id)
                    }
                }
            })
        }
        fs.writeFileSync('./data/predictors.json', JSON.stringify(predictorToWinningMarketsMapping, null, 4))

    } catch (e) {
        console.log(e)
        // fs.writeFileSync('./data/error.json', JSON.stringify(e, null, 4))
    }
}


async function getTopMarkets(chainId) {
    const { tokens, markets } = await getAllTokens(chainId)
}

getTopPredictors(100)