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

export function getRandomNextDayTimestamp(timestampInSeconds, lastDateInSeconds) {
  // Convert seconds to milliseconds
  const date = new Date(timestampInSeconds * 1000);

  // Set to start of next day (00:00:00)
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);

  // Get milliseconds for start of next day
  const nextDayStartMs = date.getTime();
  const nextDayStartSeconds = Math.floor(date.getTime()/1000);
  if (nextDayStartSeconds >= lastDateInSeconds) {
    return
  }
  let randomTimestampSeconds;
  do {
    randomTimestampSeconds = nextDayStartSeconds + Math.random() * 86400;
  } while (randomTimestampSeconds > lastDateInSeconds);

  return Math.floor(randomTimestampSeconds)
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

export function convertToFinalCSV(allData) {
  // Normalize and group by address
  const grouped = new Map();

  for (const item of allData) {
    const key = item.address
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const rows = [];

  for (const [key, records] of grouped) {
    const { address } = records[0];

    // Sort by timestamp descending for latest
    const sortedByTime = [...records].sort((a, b) => b.timestamp - a.timestamp);
    const latest = sortedByTime[0];

    // Aggregates
    let maxShare = 0;
    let maxSharePOH = 0;
    let totalSeer = 0;
    let sumShare = 0;
    let sumSharePOH = 0;
    let sumTotalHolding = 0;
    let sumIndirect = 0;
    let sumDirect = 0;

    for (const r of records) {
      maxShare = Math.max(maxShare, r.shareOfHolding ?? 0);
      maxSharePOH = Math.max(maxSharePOH, r.shareOfHoldingPoh ?? 0);
      totalSeer += r.seerTokens ?? 0;

      sumShare += r.shareOfHolding ?? 0;
      sumSharePOH += r.shareOfHoldingPoh ?? 0;
      sumTotalHolding += r.totalHolding ?? 0;
      sumIndirect += r.indirectHolding ?? 0;
      sumDirect += r.directHolding ?? 0;
    }

    const count = records.length;

    rows.push({
      address,
      latest_timestamp: new Date(latest.timestamp * 1000).toISOString(),
      latest_share_of_holding: round(latest.shareOfHolding),
      latest_share_of_holding_poh: round(latest.shareOfHoldingPoh),
      max_share_of_holding: round(maxShare),
      max_share_of_holding_poh: round(maxSharePOH),
      total_seer_tokens: round(totalSeer),
      avg_share_of_holding: round(sumShare / count),
      avg_share_of_holding_poh: round(sumSharePOH / count),
      avg_total_holding: round(sumTotalHolding / count),
      avg_indirect_holding: round(sumIndirect / count),
      avg_direct_holding: round(sumDirect / count),
    });
  }

  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")].concat(
    rows.map((row) => headers.map((h) => row[h]).join(","))
  ).join("\n");

  return csv;

  function round(val) {
    return Math.round((val ?? 0) * 10000) / 10000;
  }
}