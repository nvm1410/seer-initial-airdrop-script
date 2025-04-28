import combineQuery from "graphql-combine-query";
import { GraphQLClient } from "graphql-request";
import { COLLATERAL_TOKENS, GetPoolHourDatasDocument, SUBGRAPHS } from "./constants.js";
import { getTokenPricesMapping } from "./utils.js";
import { gnosis } from "wagmi/chains";

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
