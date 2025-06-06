import combineQuery from "graphql-combine-query";
import { GraphQLClient } from "graphql-request";
import { COLLATERAL_TOKENS, GetPoolHourDatasDocument, SUBGRAPHS } from "./constants.js";
import { getTokenPricesMapping, isTwoStringsEqual } from "./utils.js";
import { gnosis } from "wagmi/chains";

import poolHourDatas1 from '../data/poolHourDatas-1.json' with {type: 'json'}
import poolHourDatas100 from '../data/poolHourDatas-100.json' with {type: 'json'}

export async function getPrices(tokens, startTime, chainId) {
    if (tokens.length === 0) {
        return {};
    }
    const subgraphClient = new GraphQLClient(SUBGRAPHS[chainId === gnosis.id ? "algebra" : 'uniswap'][chainId]);

    const { document, variables } = (() =>
        combineQuery("GetPoolHourDatas").addN(
            GetPoolHourDatasDocument,
            tokens.map(({ tokenId, parentTokenId }) => {
                const collateral = parentTokenId
                    ? parentTokenId.toLocaleLowerCase()
                    : COLLATERAL_TOKENS[chainId].primary.address.toLocaleLowerCase();
                return {
                    first: 1,
                    orderBy: "periodStartUnix",
                    orderDirection: "desc",
                    where: {
                        pool_:
                            tokenId.toLocaleLowerCase() > collateral
                                ? { token1: tokenId.toLocaleLowerCase(), token0: collateral }
                                : { token0: tokenId.toLocaleLowerCase(), token1: collateral },
                        periodStartUnix_lte: startTime,
                        periodStartUnix_gte: startTime - 60 * 60 * 24 * 30 * 3,
                    },
                };
            }),
        ))();

    const poolHourDatas = Object.values(await subgraphClient.request(document, variables))
        .map((d) => d?.[0])
        .filter((x) => x);
    return getTokenPricesMapping(
        tokens,
        poolHourDatas.map((data) => {
            return {
                ...data.pool,
                token0Price: data.token0Price,
                token1Price: data.token1Price,
            };
        }),
        chainId,
    );
}

export function getPricesFromJson(tokens, startTime, chainId) {
    if (tokens.length === 0) {
        return {};
    }
    const poolHourDatas = chainId === 1 ? poolHourDatas1 : poolHourDatas100
    const [simpleTokens, conditionalTokens] = tokens.reduce(
        (acc, curr) => {
            acc[curr.parentTokenId ? 1 : 0].push(curr);
            return acc;
        },
        [[], []],
    );

    const simpleTokensMapping = simpleTokens.reduce(
        (acc, { tokenId }) => {
            let isTokenPrice0 = true;
            const correctPoolHourData = poolHourDatas.findLast((poolHourData) => {
                const sDAIAddress = COLLATERAL_TOKENS[chainId].primary.address;
                if (sDAIAddress > tokenId.toLocaleLowerCase()) {
                    isTokenPrice0 = false;
                    return isTwoStringsEqual(poolHourData.pool.token0.id, tokenId) && isTwoStringsEqual(poolHourData.pool.token1.id, sDAIAddress) && Number(poolHourData.periodStartUnix) <= startTime;
                }
                return isTwoStringsEqual(poolHourData.pool.token1.id, tokenId) && isTwoStringsEqual(poolHourData.pool.token0.id, sDAIAddress) && Number(poolHourData.periodStartUnix) <= startTime;
            });

            acc[tokenId.toLocaleLowerCase()] = correctPoolHourData
                ? isTokenPrice0
                    ? Number(correctPoolHourData.token0Price)
                    : Number(correctPoolHourData.token1Price)
                : 0;
            return acc;
        },
        {},
    );

    const conditionalTokensMapping = conditionalTokens.reduce(
        (acc, { tokenId, parentTokenId }) => {
            let isTokenPrice0 = true;
            const correctPoolHourData = poolHourDatas.findLast((poolHourData) => {
                if (parentTokenId.toLocaleLowerCase() > tokenId.toLocaleLowerCase()) {
                    isTokenPrice0 = false;
                    return isTwoStringsEqual(poolHourData.pool.token0.id, tokenId) && isTwoStringsEqual(poolHourData.pool.token1.id, parentTokenId) && Number(poolHourData.periodStartUnix) <= startTime;
                }
                return isTwoStringsEqual(poolHourData.pool.token1.id, tokenId) && isTwoStringsEqual(poolHourData.pool.token0.id, parentTokenId) && Number(poolHourData.periodStartUnix) <= startTime;
            });

            const relativePrice = correctPoolHourData
                ? isTokenPrice0
                    ? Number(correctPoolHourData.token0Price)
                    : Number(correctPoolHourData.token1Price)
                : 0;

            acc[tokenId.toLocaleLowerCase()] =
                relativePrice * (simpleTokensMapping?.[parentTokenId.toLocaleLowerCase()] || 0);
            return acc;
        },
        {},
    );
    return { ...simpleTokensMapping, ...conditionalTokensMapping };
}
