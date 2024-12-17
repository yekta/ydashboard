import { z } from "zod";

import {
  getCmcCryptoDefinitions,
  getCmcCryptoIds,
  getCmcLatestCryptoInfos,
  insertCmcCryptoInfosAndQuotes,
} from "@/server/db/repo/cmc";
import { cleanAndSortArray } from "@/server/redis/cache-utils";
import { cmcApiUrl } from "@/server/trpc/api/crypto/cmc/constants";
import {
  shapeCryptoInfosRawResult,
  updateCryptoDefinitionsCache,
} from "@/server/trpc/api/crypto/cmc/helpers";
import { cmcFetchOptions } from "@/server/trpc/api/crypto/cmc/secrets";
import {
  TCmcGetCryptosResult,
  TCmcGetCryptosResultRaw,
} from "@/server/trpc/api/crypto/cmc/types";
import {
  cachedPublicProcedure,
  cacheTimesMs,
  createTRPCRouter,
  publicProcedure,
} from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { after } from "next/server";

const cryptoDefinitionsMax = 1500;

export const cmcRouter = createTRPCRouter({
  getCryptoInfos: publicProcedure
    .input(
      z.object({
        ids: z.array(z.number()).max(100),
        convert: z.array(z.string()).max(3).optional().default(["USD"]),
      })
    )
    .query(async ({ input: { ids, convert }, ctx }) => {
      const cleanedIds = cleanAndSortArray(ids);
      const cleanedConvert = cleanAndSortArray(convert);

      type TReturn = TCmcGetCryptosResult;

      //// Read from Postgres cache ////
      let startRead = performance.now();
      const result: TReturn | null = await getCmcLatestCryptoInfos({
        coinIds: cleanedIds,
        currencyTickers: cleanedConvert,
        afterTimestamp: Date.now() - cacheTimesMs["seconds-long"],
      });
      const logKey = `getCryptoInfos:${cleanedConvert.join(
        ","
      )}:${cleanedIds.join(",")}`;

      const duration = Math.round(performance.now() - startRead);
      if (result) {
        console.log(`[POSTGRES_CACHE][HIT]: ${logKey} | ${duration}ms`);
        return result;
      } else {
        console.log(`[POSTGRES_CACHE][MISS]: ${logKey} | ${duration}ms`);
      }
      //////////////////////////////////

      let paddedIds = [...cleanedIds];
      // This uses the same credit amount up to 100 currencies so pad it to 100
      if (cleanedIds.length < 100) {
        const diff = 100 - cleanedIds.length;
        const newIds = await getCmcCryptoIds({
          limit: diff,
          exclude: cleanedIds,
        });
        paddedIds = cleanAndSortArray([
          ...cleanedIds,
          ...newIds.map((n) => n.id),
        ]);
      }

      const idsStr = paddedIds.join(",");
      const convertStr = cleanedConvert.join(",");
      const url = `${cmcApiUrl}/v2/cryptocurrency/quotes/latest?id=${idsStr}&convert=${convertStr}`;
      const response = await fetch(url, cmcFetchOptions);

      const resJson: TCmcGetCryptosResultRaw = await response.json();
      const data = resJson.data;
      if (!data) {
        console.log("No data in getCryptoInfo:", resJson);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No data in CMC response.",
        });
      }

      //// Write to Postgres cache ////
      const startWrite = performance.now();
      await insertCmcCryptoInfosAndQuotes({ cmcData: data });
      console.log(
        `[POSTGRES_CACHE][SET]: ${logKey} | ${Math.floor(
          performance.now() - startWrite
        )}ms`
      );
      ////////////////////////////////

      const shapedResult = shapeCryptoInfosRawResult(data, cleanedIds);
      return shapedResult;
    }),
  getGlobalMetrics: cachedPublicProcedure("minutes-short")
    .input(
      z.object({
        convert: z.string().optional().default("USD"),
      })
    )
    .query(async ({ input: { convert }, ctx }) => {
      type TReturn = TCmcGlobalMetricsResult["data"]["quote"]["USD"] & {
        fear_greed_index: TCmcFearGreedIndexResult["data"];
        eth_dominance: number;
        btc_dominance: number;
      };

      if (ctx.cachedResult) {
        return ctx.cachedResult as TReturn;
      }

      const fearAndGreedUrl = `${cmcApiUrl}/v3/fear-and-greed/latest`;
      const metricsUrl = `${cmcApiUrl}/v1/global-metrics/quotes/latest?convert=${convert}`;

      const fearGreedIndexPromise = fetch(fearAndGreedUrl, cmcFetchOptions);
      const metricsPromise = fetch(metricsUrl, cmcFetchOptions);

      const [fearGreedIndexResponse, metricsResponse] = await Promise.all([
        fearGreedIndexPromise,
        metricsPromise,
      ]);

      if (!fearGreedIndexResponse.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `${fearGreedIndexResponse.status}: Failed to fetch CMC Fear and Greed Index`,
        });
      }
      if (!metricsResponse.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `${metricsResponse.status}: Failed to fetch CMC Global Metrics`,
        });
      }

      const [fearGreedIndexData, metricsData]: [
        TCmcFearGreedIndexResult,
        TCmcGlobalMetricsResult
      ] = await Promise.all([
        fearGreedIndexResponse.json(),
        metricsResponse.json(),
      ]);

      const result: TReturn = {
        fear_greed_index: fearGreedIndexData.data,
        btc_dominance: metricsData.data.btc_dominance,
        eth_dominance: metricsData.data.eth_dominance,
        ...metricsData.data.quote[convert],
      };

      return result;
    }),
  getRankedCryptoList: cachedPublicProcedure("minutes-short")
    .input(
      z.object({
        convert: z.string().optional().default("USD"),
        page: z.number().int().positive().default(0),
      })
    )
    .query(async ({ input: { convert, page }, ctx }) => {
      type TReturn = {
        coin_list: TCmcCoinListResult["data"];
      };

      if (ctx.cachedResult) {
        return ctx.cachedResult as TReturn;
      }

      const limit = 100;
      const start = ((page || 1) - 1) * limit + 1;
      const coinListUrl = `${cmcApiUrl}/v1/cryptocurrency/listings/latest?convert=${convert}&limit=100&start=${start}`;
      const coinListPromise = fetch(coinListUrl, cmcFetchOptions);
      const [coinListResponse] = await Promise.all([coinListPromise]);

      const [coinListJson]: [TCmcCoinListResult] = await Promise.all([
        coinListResponse.json(),
      ]);

      if (!coinListResponse.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `${coinListResponse.status}: Failed to fetch CMC coin list`,
        });
      }

      const result: TReturn = {
        coin_list: coinListJson.data,
      };

      return result;
    }),
  getCryptoDefinitions: publicProcedure
    .input(
      z.object({
        limit: z
          .number()
          .int()
          .max(cryptoDefinitionsMax)
          .positive()
          .optional()
          .default(cryptoDefinitionsMax),
        offset: z.number().int().positive().optional(),
      })
    )
    .query(async ({ input: { limit, offset } }) => {
      const queryStart = Date.now();
      if (!offset) {
        offset = queryStart;
      }
      const logKey = `getCryptoDefinitions:${limit}:${offset}`;

      const start = performance.now();
      const {
        result: cryptoDefinitionsResult,
        timestamp: cryptoDefinitionsTimestamp,
      } = await getCmcCryptoDefinitions({
        limit: limit,
        offset,
      });
      const duration = Math.round(performance.now() - start);
      if (
        cryptoDefinitionsTimestamp !== null &&
        cryptoDefinitionsTimestamp >= queryStart - cacheTimesMs["hours-short"]
      ) {
        console.log(`[POSTGRES_CACHE][HIT]: ${logKey} | ${duration}ms`);
        return cryptoDefinitionsResult;
      }

      // There is no cache fresh result, update it but immediately return the stale result.
      // First time this function ever runs in the history of the app, it'll return an empty result.
      console.log(`[POSTGRES_CACHE][MISS]: ${logKey} | ${duration}ms`);
      console.log(new Date().toISOString());
      after(async () => {
        updateCryptoDefinitionsCache();
      });
      return cryptoDefinitionsResult;
    }),
});

type TCmcFearGreedIndexResult = {
  data: {
    value: number;
    value_classification: string;
    timestamp: string;
  };
};

type TCmcGlobalMetricsResult = {
  data: {
    btc_dominance: number;
    eth_dominance: number;
    quote: {
      [key: string]: {
        total_market_cap: number;
        total_volume_24h: number;
        last_updated: string;
        total_market_cap_yesterday: number;
        total_market_cap_yesterday_percentage_change: number;
      };
    };
  };
};

type TCmcCoinListResult = {
  data: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    num_market_pairs: number;
    date_added: string;
    tags: string[];
    max_supply: number;
    circulating_supply: number;
    total_supply: number;
    platform: string | null;
    cmc_rank: number;
    last_updated: string;
    quote: {
      [key: string]: {
        price: number;
        volume_24h: number;
        percent_change_1h: number;
        percent_change_24h: number;
        percent_change_7d: number;
        market_cap: number;
        last_updated: string;
      };
    };
  }[];
};
