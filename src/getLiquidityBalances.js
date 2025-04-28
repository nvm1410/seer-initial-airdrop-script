import { mainnet } from "wagmi/chains";
import { COLLATERAL_TOKENS, SUBGRAPHS } from "./constants.js";
import { getToken0Token1 } from "./utils.js";
import ethers from "ethers";

export async function fetchMints(chainId, tokenPairs) {
  const maxAttempts = 20;
  let attempt = 0;
  let allMints = [];
  let currentTimestamp = undefined;
  while (true) {
    const query = `{
          mints(first: 1000, orderBy: timestamp, orderDirection: asc, where: 
            { 
              and: [
                {
                  or: [${tokenPairs.map((tokenPair) => `{token0: "${tokenPair.token0}", token1: "${tokenPair.token1}"}`)}]
                }${currentTimestamp ? `,{timestamp_gt: "${currentTimestamp}"}` : ""}
              ]
            }) {
            id
            token0 {
              id
              symbol
            }
            token1 {
              id
              symbol
            }
            amount0
            amount1
            timestamp
            origin
          }
        }`;
    const results = await fetch(SUBGRAPHS[chainId === mainnet.id ? "uniswap" : "algebra"][chainId], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
      }),
    });
    const json = await results.json();
    const mints = (json?.data?.mints ?? []);
    allMints = allMints.concat(mints);
    if (mints[mints.length - 1]?.timestamp === currentTimestamp) {
      break;
    }
    if (mints.length < 1000) {
      break; // We've fetched all
    }
    currentTimestamp = mints[mints.length - 1]?.timestamp;
    attempt++;
  }
  return allMints.map(x => ({ ...x, type: 'mint' }));
}

export async function fetchBurns(chainId, tokenPairs) {
  const maxAttempts = 20;
  let attempt = 0;
  let allBurns = [];
  let currentTimestamp = undefined;
  while (true) {
    const query = `{
          burns(first: 1000, orderBy: timestamp, orderDirection: asc, where: 
            { 
              and: [
                {
                  or: [${tokenPairs.map((tokenPair) => `{token0: "${tokenPair.token0}", token1: "${tokenPair.token1}"}`)}]
                }${currentTimestamp ? `,{timestamp_gt: "${currentTimestamp}"}` : ""}
              ]
            }) {
            id
            token0 {
              id
              symbol
            }
            token1 {
              id
              symbol
            }
            amount0
            amount1
            timestamp
            origin
          }
        }`;
    const results = await fetch(SUBGRAPHS[chainId === mainnet.id ? "uniswap" : "algebra"][chainId], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
      }),
    });
    const json = await results.json();
    const burns = (json?.data?.burns ?? []);
    allBurns = allBurns.concat(burns);
    if (burns[burns.length - 1]?.timestamp === currentTimestamp) {
      break;
    }
    if (burns.length < 1000) {
      break; // We've fetched all
    }
    currentTimestamp = burns[burns.length - 1]?.timestamp;
    attempt++;
  }
  return allBurns.map(x => ({ ...x, type: 'burn' }));
}

export async function getAllLiquidityEvents(chainId, tokenPairs) {
  const sortedTokenPairs = tokenPairs.map(({ tokenId, parentTokenId }) => {
    const collateral = parentTokenId
      ? parentTokenId.toLocaleLowerCase()
      : COLLATERAL_TOKENS[chainId].primary.address.toLocaleLowerCase();
    return getToken0Token1(tokenId, collateral)
  })
  const mints = await fetchMints(chainId, sortedTokenPairs)
  const burns = await fetchBurns(chainId, sortedTokenPairs)
  return mints.concat(burns)
}

export function getLiquidityBalancesAtTimestamp(events, timestamp) {
  const records = events.filter(event => Number(event.timestamp) <= timestamp)
  const tokenBalances = {};

  // Process each event
  for (const event of records) {
    const { token0, token1, amount0, amount1, origin } = event
    // Initialize token balances if not exists
    if (!tokenBalances[origin]) {
      tokenBalances[origin] = {}
    }


    if (event.type === 'mint') {
      tokenBalances[origin][token0.id] = (tokenBalances[origin][token0.id] || 0) + Number(amount0);
      tokenBalances[origin][token1.id] = (tokenBalances[origin][token1.id] || 0) + Number(amount1);
    } else {
      tokenBalances[origin][token0.id] = (tokenBalances[origin][token0.id] || 0) - Number(amount0);
      tokenBalances[origin][token1.id] = (tokenBalances[origin][token1.id] || 0) - Number(amount1);
    }

  }

  const formattedBalances = {};
  for (const [user, balances] of Object.entries(tokenBalances)) {
    // Exclude zero address and non-positive balances
    if (user !== ethers.constants.AddressZero) {
      formattedBalances[user] = {};
      for (const [tokenId, balance] of Object.entries(balances)) {
        if (balance > 0) {
          formattedBalances[user][tokenId] = balance
        }
      }
    }
  }
  return formattedBalances
}