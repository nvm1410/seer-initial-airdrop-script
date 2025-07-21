import ethers from "ethers";
import fs from 'fs/promises';
import { mainnet } from "wagmi/chains";
import { COLLATERAL_TOKENS, START_TIME, SUBGRAPHS } from "./constants.js";
import { getToken0Token1, isTwoStringsEqual } from "./utils.js";
import pLimit from "p-limit";


export async function fetchPositionSnapshots(chainId, tokenPairs) {
  let allSnapshots = [];
  let currentTimestamp = undefined;
  while (true) {
    const query = `{
          positionSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc, where: 
            { 
              and: [
                {
                  or: [${tokenPairs.map((tokenPair) => `{pool_: {token0: "${tokenPair.token0}", token1: "${tokenPair.token1}"}}`)}]
                }${currentTimestamp ? `,{timestamp_gt: "${currentTimestamp}"}` : ""}
              ]
            }) {
            position{
              id
            }
            timestamp
            owner
            depositedToken0
            depositedToken1
            withdrawnToken0
            withdrawnToken1
            pool{
              token0 {
                id
              }
              token1 {
                id
              }
            }
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
    const positionSnapshots = (json?.data?.positionSnapshots ?? []);
    allSnapshots = allSnapshots.concat(positionSnapshots);
    if (positionSnapshots[positionSnapshots.length - 1]?.timestamp === currentTimestamp) {
      break;
    }
    if (positionSnapshots.length < 1000) {
      break; // We've fetched all
    }
    currentTimestamp = positionSnapshots[positionSnapshots.length - 1]?.timestamp;
  }
  return allSnapshots
}


export async function getAllPositionSnapshots(chainId, tokenPairs) {
  const sortedTokenPairs = tokenPairs.map(({ tokenId, parentTokenId }) => {
    const collateral = parentTokenId
      ? parentTokenId.toLocaleLowerCase()
      : COLLATERAL_TOKENS[chainId].primary.address.toLocaleLowerCase();
    return getToken0Token1(tokenId, collateral)
  })
  return await fetchPositionSnapshots(chainId, sortedTokenPairs)
}

export function getLiquidityBalancesByPositionAtTimestamp(positionSnapshots, timestamp) {
  const farmingContract = '0xDe51dDF1aE7d5BBD7bF1A0e40aAA1F6C12579106'
  const uniquePositionsSnapshotsMapping = positionSnapshots.reduce((acc, snapshot) => {
    const currentPositionTimestamp = acc[snapshot.position.id]?.timestamp
    if (!currentPositionTimestamp || (Number(snapshot.timestamp) > Number(currentPositionTimestamp) && Number(snapshot.timestamp) <= timestamp && !isTwoStringsEqual(snapshot.owner, farmingContract))) {
      acc[snapshot.position.id] = snapshot
    }
    return acc
  }, {})
  const records = Object.values(uniquePositionsSnapshotsMapping)
  const tokenBalances = {};
  // Process each event
  for (const snapshot of records) {

    try {
      const { pool: { token0, token1 }, depositedToken0, depositedToken1, withdrawnToken0, withdrawnToken1, owner } = snapshot
      const amount0 = Number(depositedToken0) - Number(withdrawnToken0)
      const amount1 = Number(depositedToken1) - Number(withdrawnToken1)
      // Initialize token balances if not exists
      if (!tokenBalances[owner]) {
        tokenBalances[owner] = {}
      }


      tokenBalances[owner][token0.id] = (tokenBalances[owner][token0.id] || 0) + Number(amount0);
      tokenBalances[owner][token1.id] = (tokenBalances[owner][token1.id] || 0) + Number(amount1);
    } catch (e) {
      console.log(snapshot)
      throw (e)
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

export async function getPositionSnapshotsByTokenPair(chainId, tokenPair) {
  let allData = [];
  let initialTimestamp = START_TIME[chainId]
  let currentTimestamp = initialTimestamp;

  const maxRetries = 3;
  let counter = 0

  while (true) {
    let retries = 0;
    let success = false;
    let positionSnapshots = [];

    while (retries < maxRetries && !success) {
      try {
        const query = `{
                    positionSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc${currentTimestamp ? `, where: {timestamp_gt: ${currentTimestamp}, pool_: {token0: "${tokenPair.token0}", token1: "${tokenPair.token1}"}}` : `, where: {pool_: {token0: "${tokenPair.token0}", token1: "${tokenPair.token1}"}}`}) {
                    position{
                      id
                    }
                    timestamp
                    owner
                    depositedToken0
                    depositedToken1
                    withdrawnToken0
                    withdrawnToken1
                    pool{
                      token0 {
                        id
                      }
                      token1 {
                        id
                      }
                    }
                    }
                }`;

        const results = await fetch(SUBGRAPHS[chainId === mainnet.id ? "uniswap" : "algebra"][chainId], {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });
        if (!results.ok) {
          throw new Error(`HTTP error! status: ${results.status}`);
        }

        const json = await results.json();
        if (json.errors?.length) {
          throw json.errors[0].message
        }
        positionSnapshots = json?.data?.positionSnapshots ?? [];
        success = true;
        counter++

      } catch (error) {
        retries++;

        if (retries === maxRetries) {
          throw new Error(`Max retries reached for timestamp ${currentTimestamp}. ${error.message}`);
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
      }
    }

    allData = allData.concat(positionSnapshots);
    console.log(`Count: ${counter}. Fetched ${positionSnapshots.length} records. Total: ${allData.length}`);

    // Break conditions
    if (positionSnapshots.length === 0 ||
      positionSnapshots[positionSnapshots.length - 1]?.timestamp === currentTimestamp) {
      break;
    }
    if (positionSnapshots.length < 1000) {
      break; // We've fetched all
    }

    currentTimestamp = positionSnapshots[positionSnapshots.length - 1]?.timestamp;

    // wait 300ms between calls
    await new Promise(res => setTimeout(res, 300))
  }
  return allData;
}

export async function getPositionSnapshotsByTokenPairs(chainId, tokenPairs) {
  const limit = pLimit(50)
  const sortedTokenPairs = tokenPairs.map(({ tokenId, parentTokenId }) => {
    const collateral = parentTokenId
      ? parentTokenId.toLocaleLowerCase()
      : COLLATERAL_TOKENS[chainId].primary.address.toLocaleLowerCase();
    return getToken0Token1(tokenId, collateral)
  })
  const promises = []
  for (const tokenPair of sortedTokenPairs) {
    promises.push(limit(()=>getPositionSnapshotsByTokenPair(chainId, tokenPair)))
  }
  const allData = (await Promise.all(promises)).flat()
  allData.sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
  await fs.writeFile(`./data/positionSnapshots-${chainId}.json`, JSON.stringify(allData, null, 4))
}