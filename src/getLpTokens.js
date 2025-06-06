import ethers from "ethers";
import fs from 'fs/promises';
import { mainnet } from "wagmi/chains";
import { COLLATERAL_TOKENS, START_TIME, SUBGRAPHS } from "./constants.js";
import { getToken0Token1 } from "./utils.js";



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

  let allData = []
  const sortedTokenPairs = tokenPairs.map(({ tokenId, parentTokenId }) => {
    const collateral = parentTokenId
      ? parentTokenId.toLocaleLowerCase()
      : COLLATERAL_TOKENS[chainId].primary.address.toLocaleLowerCase();
    return getToken0Token1(tokenId, collateral)
  })
  for (const tokenPair of sortedTokenPairs) {
    const data = await getBunniLpTokensByTokenPair(chainId, tokenPair)
    allData.push(...data)
  }
  await fs.writeFile(`./data/bunniTokens-${chainId}.json`, JSON.stringify(Array.from(new Set(allData.map(x => x.address))), null, 4))
}