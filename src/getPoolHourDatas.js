import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import JSONStream from 'JSONStream';
import { mainnet } from "wagmi/chains";
import { COLLATERAL_TOKENS, START_TIME, SUBGRAPHS } from "./constants.js";
import { getToken0Token1 } from "./utils.js";
import pLimit from "p-limit";

export async function getPoolHourDatas(chainId) {
    let allData = [];
    let initialPeriodStartUnix = START_TIME[chainId]
    let currentPeriodStartUnix = initialPeriodStartUnix;
    const outputFile = `./data/poolHourDatas-${chainId}.json`
    const maxRetries = 3;
    let counter = 0
    const writeStream = createWriteStream(outputFile, { flags: 'a' });
    const jsonStream = JSONStream.stringify('[', ',', ']');
    jsonStream.pipe(writeStream);
    // Load existing data if file exists
    try {
        const existingData = await fs.readFile(outputFile, 'utf8');
        allData = JSON.parse(existingData);
        if (Array.from(new Set(allData.map(x => x.id))).length !== allData.length) {
            throw ('duplicate records')
        }
        currentPeriodStartUnix = allData[allData.length - 1]?.periodStartUnix || initialPeriodStartUnix;
        console.log(`Resumed from ${allData.length} records`);
    } catch (error) {
        if (error === 'duplicate records') {
            throw (error)
        }
        console.log('Starting with empty dataset');
    }

    while (true) {
        let retries = 0;
        let success = false;
        let poolHourDatas = [];

        while (retries < maxRetries && !success) {
            try {
                const query = `{
                    poolHourDatas(first: 1000, orderBy: periodStartUnix, orderDirection: asc${currentPeriodStartUnix ? `, where: {periodStartUnix_gt: ${currentPeriodStartUnix}}` : ''}) {
                    id
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
                poolHourDatas = json?.data?.poolHourDatas ?? [];
                success = true;
                counter++

            } catch (error) {
                retries++;

                if (retries === maxRetries) {
                    jsonStream.end();
                    writeStream.end();
                    throw new Error(`Max retries reached for periodStartUnix ${currentPeriodStartUnix}. ${error.message}`);
                }

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
            }
        }

        allData = allData.concat(poolHourDatas);
        console.log(`Count: ${counter}. Fetched ${poolHourDatas.length} records. Total: ${allData.length}`);
        // Save to file every batchSize records
        try {
            for (const record of allData) {
                jsonStream.write(record);
            }
            await new Promise(resolve => {
                writeStream.once('drain', resolve);
                jsonStream.write(null); // Trigger flush
            });
            console.log(`Saved batch of ${allData.length} records`);
        } catch (error) {
            throw (`Error saving to file: ${error.message}`);
        }

        // Break conditions
        if (poolHourDatas.length === 0 ||
            poolHourDatas[poolHourDatas.length - 1]?.periodStartUnix === currentPeriodStartUnix) {
            break;
        }
        if (poolHourDatas.length < 1000) {
            break; // We've fetched all
        }

        currentPeriodStartUnix = poolHourDatas[poolHourDatas.length - 1]?.periodStartUnix;

        // wait 300ms between calls
        await new Promise(res => setTimeout(res, 300))
    }
    jsonStream.end();
    await new Promise(resolve => writeStream.on('finish', resolve));
    return allData;
}

export async function getPoolHourDatasByTokenPair(chainId, tokenPair) {
    let allData = [];
    let initialPeriodStartUnix = START_TIME[chainId]
    let currentPeriodStartUnix = initialPeriodStartUnix;

    const maxRetries = 3;
    let counter = 0

    while (true) {
        let retries = 0;
        let success = false;
        let poolHourDatas = [];

        while (retries < maxRetries && !success) {
            try {
                const query = `{
                    poolHourDatas(first: 1000, orderBy: periodStartUnix, orderDirection: asc${currentPeriodStartUnix ? `, where: {periodStartUnix_gt: ${currentPeriodStartUnix}, pool_: {token0: "${tokenPair.token0}", token1: "${tokenPair.token1}"}}` : `, where: {pool_: {token0: "${tokenPair.token0}", token1: "${tokenPair.token1}"}}`}) {
                    id
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
                poolHourDatas = json?.data?.poolHourDatas ?? [];
                success = true;
                counter++

            } catch (error) {
                retries++;

                if (retries === maxRetries) {
                    throw new Error(`Max retries reached for periodStartUnix ${currentPeriodStartUnix}. ${error.message}`);
                }

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)));
            }
        }

        allData = allData.concat(poolHourDatas);
        console.log(`Count: ${counter}. Fetched ${poolHourDatas.length} records. Total: ${allData.length}`);

        // Break conditions
        if (poolHourDatas.length === 0 ||
            poolHourDatas[poolHourDatas.length - 1]?.periodStartUnix === currentPeriodStartUnix) {
            break;
        }
        if (poolHourDatas.length < 1000) {
            break; // We've fetched all
        }

        currentPeriodStartUnix = poolHourDatas[poolHourDatas.length - 1]?.periodStartUnix;

        // wait 300ms between calls
        await new Promise(res => setTimeout(res, 300))
    }
    return allData;
}

export async function getPoolHourDatasByTokenPairs(chainId, tokenPairs) {
    
    const limit = pLimit(50)
    const sortedTokenPairs = tokenPairs.map(({ tokenId, parentTokenId }) => {
        const collateral = parentTokenId
            ? parentTokenId.toLocaleLowerCase()
            : COLLATERAL_TOKENS[chainId].primary.address.toLocaleLowerCase();
        return getToken0Token1(tokenId, collateral)
    })
    const promises = []
    for (const tokenPair of sortedTokenPairs) {
        promises.push(limit(()=>getPoolHourDatasByTokenPair(chainId, tokenPair)))
    }
    const allData = (await Promise.all(promises)).flat()
    allData.sort((a, b) => Number(a.periodStartUnix) - Number(b.periodStartUnix))
    await fs.writeFile(`./data/poolHourDatas-${chainId}.json`, JSON.stringify(allData, null, 4))
}