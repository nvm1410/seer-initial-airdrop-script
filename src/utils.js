import { COLLATERAL_TOKENS } from './constants.js'

export function getTokenPricesMapping(
  tokens,
  pools,
  chainId,
) {
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
      const correctPool = pools.find((pool) => {
        const sDAIAddress = COLLATERAL_TOKENS[chainId].primary.address;
        if (sDAIAddress > tokenId.toLocaleLowerCase()) {
          isTokenPrice0 = false;
          return isTwoStringsEqual(pool.token0.id, tokenId) && isTwoStringsEqual(pool.token1.id, sDAIAddress);
        }
        return isTwoStringsEqual(pool.token1.id, tokenId) && isTwoStringsEqual(pool.token0.id, sDAIAddress);
      });

      acc[tokenId.toLocaleLowerCase()] = correctPool
        ? isTokenPrice0
          ? Number(correctPool.token0Price)
          : Number(correctPool.token1Price)
        : 0;
      return acc;
    },
    {},
  );

  const conditionalTokensMapping = conditionalTokens.reduce(
    (acc, { tokenId, parentTokenId }) => {
      let isTokenPrice0 = true;
      const correctPool = pools.find((pool) => {
        if (parentTokenId.toLocaleLowerCase() > tokenId.toLocaleLowerCase()) {
          isTokenPrice0 = false;
          return isTwoStringsEqual(pool.token0.id, tokenId) && isTwoStringsEqual(pool.token1.id, parentTokenId);
        }
        return isTwoStringsEqual(pool.token1.id, tokenId) && isTwoStringsEqual(pool.token0.id, parentTokenId);
      });

      const relativePrice = correctPool
        ? isTokenPrice0
          ? Number(correctPool.token0Price)
          : Number(correctPool.token1Price)
        : 0;

      acc[tokenId.toLocaleLowerCase()] =
        relativePrice * (simpleTokensMapping?.[parentTokenId.toLocaleLowerCase()] || 0);
      return acc;
    },
    {},
  );

  return { ...simpleTokensMapping, ...conditionalTokensMapping };
}

export function getDailyTimestampsLast30Days() {
  const timestamps = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - i
    ));
    timestamps.push(date.getTime() / 1000);
  }

  return timestamps;
}

export function getRandomTimestamps(startTimestamp, count) {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  if (startTimestamp > now) {
    throw new Error('Start timestamp cannot be in the future');
  }
  if (count < 0) {
    throw new Error('Count must be non-negative');
  }
  if (count > now - startTimestamp + 1) {
    throw new Error('Requested count exceeds possible unique timestamps');
  }

  const timestamps = new Set();
  while (timestamps.size < count) {
    const randomTimestamp = Math.floor(startTimestamp + Math.random() * (now - startTimestamp + 1));
    timestamps.add(randomTimestamp);
  }
  return Array.from(timestamps).sort((a, b) => a - b);
}

export function isTwoStringsEqual(str1, str2) {
  return str1?.trim() && str2?.trim()?.toLocaleLowerCase() === str1?.trim()?.toLocaleLowerCase();
}

export function getToken0Token1(token0, token1) {
  return token0.toLocaleLowerCase() > token1.toLocaleLowerCase()
    ? { token0: token1.toLocaleLowerCase(), token1: token0.toLocaleLowerCase() }
    : { token0: token0.toLocaleLowerCase(), token1: token1.toLocaleLowerCase() };
}

export function parseToCsv(headers, data) {
  // Create CSV header row with display titles
  const headerRow = headers
    .map((header) => {
      const stringValue = header.title;
      // Escape quotes and wrap in quotes if the value contains comma or quotes
      if (stringValue.includes(",") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    })
    .join(",");

  // Create CSV data rows using header keys
  const rows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header.key];

        // Handle different types of values
        if (value === null || value === undefined) {
          return "";
        }

        // Escape quotes and wrap in quotes if the value contains comma or quotes
        const stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
      })
      .join(",");
  });

  // Combine headers and rows
  const csvContent = [headerRow, ...rows].join("\n");

  return csvContent
}