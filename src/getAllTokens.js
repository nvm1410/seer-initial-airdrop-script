import { zeroAddress } from "viem";
import { SUBGRAPHS } from "./constants.js";

export async function fetchMarkets(chainId) {
    const maxAttempts = 20;
    let attempt = 0;
    let allMarkets = [];
    let currentId = undefined;
    while (attempt < maxAttempts) {
        const query = `{
          markets(first: 1000, orderBy: id, orderDirection: asc${currentId ? `, where: {id_gt: "${currentId}"}` : ""
            }) {
            id
            type
            marketName
            outcomes
            templateId
            questions {
              id
            }
            collateralToken
            collateralToken1
            collateralToken2
            outcomesSupply
            payoutReported
            payoutNumerators
            parentMarket{
              id
            }
            parentOutcome
            wrappedTokens
            creator
            finalizeTs
          }
        }`;
        const results = await fetch(SUBGRAPHS['seer'][chainId], {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
            }),
        });
        const json = await results.json();
        const markets = (json?.data?.markets ?? []);
        allMarkets = allMarkets.concat(markets);

        if (markets[markets.length - 1]?.id === currentId) {
            break;
        }
        if (markets.length < 1000) {
            break; // We've fetched all markets
        }
        currentId = markets[markets.length - 1]?.id;
        attempt++;
    }
    return allMarkets.map((market) => ({
        ...market,
        parentMarket: market.parentMarket ?? { id: zeroAddress },
    }));
}

export async function getAllTokens(chainId) {
    const markets = await fetchMarkets(chainId.toString()).then((markets) => markets.map((market) => ({ ...market, chainId })))
    const marketIdToMarket = markets.reduce(
        (acum, market) => {
            acum[market.id] = market
            return acum;
        },
        {},
    );
    const tokens = markets.reduce(
        (acum, market) => {
            const parentMarket = marketIdToMarket[market.parentMarket.id]
            const parentTokenId = parentMarket ? parentMarket.wrappedTokens[Number(market.parentOutcome)] : undefined
            for (let i = 0; i < market.wrappedTokens.length; i++) {
                const tokenId = market.wrappedTokens[i];
                acum.push({
                    tokenId,
                    parentTokenId,
                })
            }
            return acum;
        },
        [],
    );
    return { tokens, markets }
}

export function getTokensByTimestamp(markets, timestamps) {
    return timestamps.reduce((acc, timestamp) => {
        acc[timestamp.toString()] = markets.reduce(
            (acum, market) => {
                if (Number(market.finalizeTs) < timestamp) {
                    for (let i = 0; i < market.wrappedTokens.length; i++) {
                        const tokenId = market.wrappedTokens[i];
                        acum[tokenId] = true
                    }
                }
                return acum;
            },
            {},
        );
        return acc
    }, {})
}