import gql from 'graphql-tag';
import { gnosis, mainnet } from 'wagmi/chains';

export const NATIVE_TOKEN = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const api = "8b2690ffdd390bad59638b894ee8d9f6";
export const CHAIN_IDS = [gnosis.id, mainnet.id]
export const SUBGRAPHS = {
    seer: {
        [gnosis.id]: `https://gateway-arbitrum.network.thegraph.com/api/${api}/subgraphs/id/B4vyRqJaSHD8dRDb3BFRoAzuBK18c1QQcXq94JbxDxWH`,
        [mainnet.id]: `https://gateway-arbitrum.network.thegraph.com/api/${api}/subgraphs/id/BMQD869m8LnGJJfqMRjcQ16RTyUw6EUx5jkh3qWhSn3M`,
    },
    curate: {
        // TODO: add fallback urls? or change subgraph?
        [gnosis.id]: `https://gateway-arbitrum.network.thegraph.com/api/${api}/subgraphs/id/9hHo5MpjpC1JqfD3BsgFnojGurXRHTrHWcUcZPPCo6m8`,
        [mainnet.id]: `https://gateway-arbitrum.network.thegraph.com/api/${api}/subgraphs/id/A5oqWboEuDezwqpkaJjih4ckGhoHRoXZExqUbja2k1NQ`,
    },
    algebra: {
        [gnosis.id]: `https://gateway-arbitrum.network.thegraph.com/api/${api}/subgraphs/id/AAA1vYjxwFHzbt6qKwLHNcDSASyr1J1xVViDH8gTMFMR`,
    },
    algebrafarming: {
        [gnosis.id]: `https://gateway-arbitrum.network.thegraph.com/api/${api}/subgraphs/id/4WysHZ1gFJcv1HLAobLMx3dS9B6aovExzyG3n7kRjwKT`,
    },
    uniswap: {
        [mainnet.id]: `https://gateway.thegraph.com/api/${api}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`,
    },
    tokens: {
        [gnosis.id]: `https://gateway.thegraph.com/api/a3d37662f27d87b20e3d8d7149e85910/subgraphs/id/DJKN6orXh7MUv5y94WumfvRxyV1khuZhXtCMjQM349ru`,
        [mainnet.id]: `https://gateway.thegraph.com/api/a3d37662f27d87b20e3d8d7149e85910/subgraphs/id/D1bjzs39GBk5HDrNm5ui27TDpX6pMqp8omUCRr79CjSQ`,
    },
    poh: {
        [gnosis.id]: `https://gateway.thegraph.com/api/d5c7982a40f63da9504805d11919004d/subgraphs/id/FFx16fGNSpdq2TpQer3KqpadP8UaLELS4Jocd1LtwAmG`,
        [mainnet.id]: `https://gateway.thegraph.com/api/d5c7982a40f63da9504805d11919004d/subgraphs/id/8oHw9qNXdeCT2Dt4QPZK9qHZNAhPWNVrCKnFDarYEJF5`,
    }
};

export const GetPoolHourDatasDocument = gql`
    query GetPoolHourDatas($skip: Int = 0, $first: Int, $where: PoolHourData_filter, $orderBy: PoolHourData_orderBy, $orderDirection: OrderDirection, $block: Block_height, $subgraphError: _SubgraphErrorPolicy_! = deny) {
  poolHourDatas(
    skip: $skip
    first: $first
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
    block: $block
    subgraphError: $subgraphError
  ) {
    token0Price
    token1Price
    periodStartUnix
    sqrtPrice
    liquidity
    pool {
      id
      liquidity
      token0 {
        id
        name
      }
      token1 {
        id
        name
      }
    }
  }
}
    `;

export const COLLATERAL_TOKENS = {
    [gnosis.id]: {
        primary: { address: "0xaf204776c7245bf4147c2612bf6e5972ee483701", symbol: "sDAI", decimals: 18 },
        secondary: {
            address: NATIVE_TOKEN,
            symbol: "xDAI",
            decimals: 18,
            wrapped: { address: "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d", symbol: "wxDAI", decimals: 18 },
        },
    },
    [mainnet.id]: {
        primary: { address: "0x83F20F44975D03b1b09e64809B757c47f942BEeA", symbol: "sDAI", decimals: 18 },
        secondary: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18 },
    },
};

export const RPC_URLS = {
    [gnosis.id]: 'https://gnosis-pokt.nodies.app',
    [mainnet.id]: 'https://eth-pokt.nodies.app'
}

export const SER_LPP = {
    [gnosis.id]: '0xa7a7f8d1770c08e2e1f55d8c6427c1f8213a34da'
}

export const START_TIME = {
    [gnosis.id]: 1728416320,
    [mainnet.id]: 1728082727
}