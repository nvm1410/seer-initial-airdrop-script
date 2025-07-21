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


function buildPoolMap(poolHourDatas) {
    const map = new Map();
    for (const data of poolHourDatas) {
        const token0 = data.pool.token0.id.toLowerCase();
        const token1 = data.pool.token1.id.toLowerCase();
        const key = `${token0}_${token1}`
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(data);
    }
    // Sort each array descending by timestamp so findLast becomes findFirst
    for (const list of map.values()) {
        list.sort((a, b) => Number(b.periodStartUnix) - Number(a.periodStartUnix));
    }
    return map;
}

function getLatestPoolData(poolList, startTime) {
    for (const data of poolList ?? []) {
        if (Number(data.periodStartUnix) <= startTime) {
            return data;
        }
    }
    return null;
}

export function getPricesFromJson(tokens, startTime, chainId) {
    if (!tokens.length) return {};

    const poolHourDatas = chainId === 1 ? poolHourDatas1 : poolHourDatas100;
    const poolMap = buildPoolMap(poolHourDatas);

    const [simpleTokens, conditionalTokens] = tokens.reduce(
        (acc, curr) => {
            acc[curr.parentTokenId ? 1 : 0].push(curr);
            return acc;
        },
        [[], []],
    );

    const sDAIAddress = COLLATERAL_TOKENS[chainId].primary.address.toLowerCase();
    const simpleTokensMapping = {};

    for (const { tokenId } of simpleTokens) {
        const tid = tokenId.toLowerCase();
        const [t0, t1] = tid < sDAIAddress ? [tid, sDAIAddress] : [sDAIAddress, tid];
        const key = `${t0}_${t1}`;
        const data = getLatestPoolData(poolMap.get(key), startTime);
        simpleTokensMapping[tid] = data
            ? (data.pool.token0.id.toLowerCase() === tid ? Number(data.token1Price) : Number(data.token0Price))
            : 0;
    }

    const conditionalTokensMapping = {};
    for (const { tokenId, parentTokenId } of conditionalTokens) {
        const tid = tokenId.toLowerCase();
        const pid = parentTokenId.toLowerCase();
        const [t0, t1] = tid < pid ? [tid, pid] : [pid, tid];
        const key = `${t0}_${t1}`;
        const data = getLatestPoolData(poolMap.get(key), startTime);
        const relativePrice = data
            ? (data.pool.token0.id.toLowerCase() === tid ? Number(data.token1Price) : Number(data.token0Price))
            : 0;
        conditionalTokensMapping[tid] = relativePrice * (simpleTokensMapping[pid] || 0);
    }

    return { ...simpleTokensMapping, ...conditionalTokensMapping };
}
