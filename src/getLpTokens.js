import ethers, { BigNumber, } from "ethers";
import fs from 'fs/promises';
import { COLLATERAL_TOKENS } from "./constants.js";
import { calculateBurnAmounts, getToken0Token1 } from "./utils.js";
import pLimit from "p-limit";
import bunniGauges from '../data/bunniGauges-1.json' with {type: 'json'}


export async function getBunniLpTokensByTokenPair(chainId, tokenPair) {
  let allData = [];
  let currentId;

  const maxRetries = 3;
  let counter = 0

  while (true) {
    let retries = 0;
    let success = false;
    let bunniTokens = [];

    while (retries < maxRetries && !success) {
      try {
        const query = `{
                    bunniTokens(first: 1000, orderBy: id, orderDirection: asc${currentId ? `, where: {id_gt: ${currentId}, pool_: {token0: "${tokenPair.token0}", token1: "${tokenPair.token1}"}}` : `, where: {pool_: {token0: "${tokenPair.token0}", token1: "${tokenPair.token1}"}}`}) {
                      id
                      name
                      symbol
                      address
                      gauge {
                        address
                      }
                    }
                }`;

        const results = await fetch("https://gateway.thegraph.com/api/a3d37662f27d87b20e3d8d7149e85910/subgraphs/id/HH4HFj4rFnm5qnkb8MbEdP2V5eD9rZnLJE921YQAs7AV", {
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
        bunniTokens = json?.data?.bunniTokens ?? [];
        success = true;
        counter++

      } catch (error) {
        retries++;

        if (retries === maxRetries) {
          throw new Error(`Max retries reached for id ${currentId}. ${error.message}`);
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
      }
    }

    allData = allData.concat(bunniTokens);
    console.log(`Count: ${counter}. Fetched ${bunniTokens.length} records. Total: ${allData.length}`);

    // Break conditions
    if (bunniTokens.length === 0 ||
      bunniTokens[bunniTokens.length - 1]?.id === currentId) {
      break;
    }
    if (bunniTokens.length < 1000) {
      break; // We've fetched all
    }

    currentId = bunniTokens[bunniTokens.length - 1]?.id;

    // wait 300ms between calls
    await new Promise(res => setTimeout(res, 300))
  }
  return allData;
}

export async function getBunniLpTokensByTokenPairs(chainId, tokenPairs) {
  if (chainId !== 1) return []
  const limit = pLimit(50)
  const promises = []
  const sortedTokenPairs = tokenPairs.map(({ tokenId, parentTokenId }) => {
    const collateral = parentTokenId
      ? parentTokenId.toLocaleLowerCase()
      : COLLATERAL_TOKENS[chainId].primary.address.toLocaleLowerCase();
    return getToken0Token1(tokenId, collateral)
  })
  for (const tokenPair of sortedTokenPairs) {
    promises.push(limit(() => getBunniLpTokensByTokenPair(chainId, tokenPair)))
  }
  const allData = (await Promise.all(promises)).flat()
  await fs.writeFile(`./data/bunniTokens-${chainId}.json`, JSON.stringify(Array.from(new Set(allData.map(x => x.address))), null, 4))
  await fs.writeFile(`./data/bunniGauges-${chainId}.json`, JSON.stringify(Array.from(new Set(allData.map(x => x.gauge?.address).filter(x => x))), null, 4))
  return {
    tokens: Array.from(new Set(allData.map(x => x.address))),
    gauges: Array.from(new Set(allData.map(x => x.gauge?.id).filter(x => x)))
  }
}

export async function getBunniLpTokensTransferEvents(bunniLpTokens) {
  let allTransfers = [];
  let currentTimestamp = undefined;

  while (true) {
    const query = `{
              positionSnapshots(first: 1000, orderBy: timestamp, orderDirection: asc${currentTimestamp ? `, where: {timestamp_gt: "${currentTimestamp}", token_in:[${bunniLpTokens.map(token => `"${token}"`)}]}` : `, where: {token_in:[${bunniLpTokens.map(token => `"${token}"`)}]}`
      }) {
                id
                token {
                    id
                    tickLower
                    tickUpper
                }
                totalSupply
                liquidity
                tick
                
                token0
                token1
                transfer{
                  from
                  to
                  value
                }
                timestamp
                blockNumber
              }
            }`;
    const results = await fetch("https://api.studio.thegraph.com/query/101341/seer-lp-tokens-mainnet/version/latest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
      }),
    });
    const json = await results.json();
    const transfers = (json?.data?.positionSnapshots ?? []);
    allTransfers = allTransfers.concat(transfers);

    if (transfers[transfers.length - 1]?.timestamp === currentTimestamp) {
      break;
    }
    if (transfers.length < 1000) {
      break; // We've fetched all
    }
    currentTimestamp = transfers[transfers.length - 1]?.timestamp;
  }
  return allTransfers
}

export function getBunniPositionHoldersAtTimestamp(allPositionSnapshots, timestamp) {
  const balances = {};
  const ignoredAddrs = new Set(bunniGauges.map(addr => addr.toLowerCase()));
  for (const snapshot of allPositionSnapshots) {
    if (Number(snapshot.timestamp) > timestamp) continue;

    const from = snapshot.transfer.from.toLowerCase();
    const to = snapshot.transfer.to.toLowerCase();

    // Skip if either side is a Bunni gauge
    if (ignoredAddrs.has(from) || ignoredAddrs.has(to)) continue;

    if (from === ethers.constants.AddressZero || to === ethers.constants.AddressZero) continue

    const value = BigNumber.from(snapshot.transfer.value || '0');

    const liquidityRaw = snapshot.liquidity;
    const totalSupplyRaw = snapshot.totalSupply;

    // Skip if invalid liquidity or totalSupply
    if (!liquidityRaw || !totalSupplyRaw || totalSupplyRaw === '0') continue;

    const liquidity = BigNumber.from(liquidityRaw);
    const totalSupply = BigNumber.from(totalSupplyRaw);

    const tickCurrent = Number(snapshot.tick);
    const tickLower = Number(snapshot.token.tickLower);
    const tickUpper = Number(snapshot.token.tickUpper);

    const token0 = (snapshot.token0 || '').toLowerCase();
    const token1 = (snapshot.token1 || '').toLowerCase();

    if (!token0 || !token1) continue;

    const { amount0, amount1 } = calculateBurnAmounts(
      value,
      totalSupply,
      liquidity,
      tickCurrent,
      tickLower,
      tickUpper
    );


    // Initialize balances for both addresses and tokens
    for (const addr of [from, to]) {
      if (!balances[addr]) balances[addr] = {};
      if (!balances[addr][token0]) balances[addr][token0] = BigNumber.from(0);
      if (!balances[addr][token1]) balances[addr][token1] = BigNumber.from(0);
    }

    // Subtract from sender
    if (from !== ethers.constants.AddressZero) {
      balances[from][token0] = balances[from][token0].sub(amount0);
      balances[from][token1] = balances[from][token1].sub(amount1);
    }

    // Add to recipient
    if (to !== ethers.constants.AddressZero) {
      balances[to][token0] = balances[to][token0].add(amount0);
      balances[to][token1] = balances[to][token1].add(amount1);
    }
  }

  // Format result: only positive balances shown
  const formatted = {};
  for (const [addr, tokens] of Object.entries(balances)) {
    const display = {};
    for (const [token, amount] of Object.entries(tokens)) {
      if (amount.gt(0) || amount.lt(0)) {
        display[token] = Number(ethers.utils.formatUnits(amount, 18));
      }
    }
    if (Object.keys(display).length > 0) {
      formatted[addr] = display;
    }
  }

  return formatted;
}