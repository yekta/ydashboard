import { z } from "zod";

import { getExchangeInstance } from "@/server/api/routers/exchange/helpers";
import {
  ExchangeSchema,
  TOHLCVResult,
  TOrderBook,
} from "@/server/api/routers/exchange/types";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { OHLCV, OrderBook, Ticker } from "ccxt";

const OrderbookInputSchema = z.object({
  exchange: ExchangeSchema,
  ticker: z.string(),
  limit: z.number(),
});

const OHLCVInputSchema = z.object({
  exchange: ExchangeSchema,
  ticker: z.string(),
  timeframe: z.string().default("1d"),
  since: z.number().default(Date.now() - 1000 * 60 * 60 * 24 * 30),
});

export const exchangeRouter = createTRPCRouter({
  getOrderBook: publicProcedure
    .input(OrderbookInputSchema)
    .query(async ({ input }) => {
      const promises = getOrderbookPromiseObject(input);
      const [book, tickerInfo] = await Promise.all([
        promises.orderBookPromise,
        promises.tickerInfoPromise,
      ]);
      return parseOrderbookResult(book, tickerInfo, input);
    }),

  getOrderBooks: publicProcedure
    .input(z.array(OrderbookInputSchema))
    .query(async ({ input }) => {
      const promises = input.map(getOrderbookPromiseObject);
      const orderBookPromises = promises.map((p) => p.orderBookPromise);
      const tickerInfoPromises = promises.map((p) => p.tickerInfoPromise);

      const allRes = await Promise.all([
        ...orderBookPromises,
        ...tickerInfoPromises,
      ]);

      const orderBookResults = allRes.slice(
        0,
        orderBookPromises.length
      ) as OrderBook[];
      const tickerInfoResults = allRes.slice(
        orderBookPromises.length,
        allRes.length
      ) as Ticker[];

      let orderBooks = orderBookResults.map((book, index) =>
        parseOrderbookResult(book, tickerInfoResults[index], input[index])
      );
      return orderBooks;
    }),

  getOHLCV: publicProcedure.input(OHLCVInputSchema).query(async ({ input }) => {
    const promises = getOHLCVPromiseObject(input);
    const [data, tickerInfo] = await Promise.all([
      promises.ohlcvPromise,
      promises.tickerInfoPromise,
    ]);
    return parseOHLCVResult(data, tickerInfo, input);
  }),

  getOHLCVs: publicProcedure
    .input(z.array(OHLCVInputSchema))
    .query(async ({ input }) => {
      const promises = input.map(getOHLCVPromiseObject);
      const ohlcvPromises = promises.map((p) => p.ohlcvPromise);
      const tickerInfoPromises = promises.map((p) => p.tickerInfoPromise);

      const allRes = await Promise.all([
        ...ohlcvPromises,
        ...tickerInfoPromises,
      ]);

      const ohlcvRes = allRes.slice(0, ohlcvPromises.length) as OHLCV[][];
      const tickerInfoRes = allRes.slice(
        ohlcvPromises.length,
        allRes.length
      ) as Ticker[];

      let ohlcvResults = ohlcvRes.map((data, index) =>
        parseOHLCVResult(data, tickerInfoRes[index], input[index])
      );
      return ohlcvResults;
    }),
});

function getOrderbookPromiseObject(
  input: z.infer<typeof OrderbookInputSchema>
) {
  const { exchange, ticker, limit } = input;
  let exchangeInstance = getExchangeInstance(exchange);
  return {
    orderBookPromise: exchangeInstance.fetchOrderBook(ticker, limit),
    tickerInfoPromise: exchangeInstance.fetchTicker(ticker),
  };
}

function parseOrderbookResult(
  book: OrderBook,
  tickerInfo: Ticker,
  input: z.infer<typeof OrderbookInputSchema>
): TOrderBook {
  let orderBook: TOrderBook = {
    asks: [],
    bids: [],
    metadata: {
      exchange: input.exchange,
      ticker: input.ticker,
      volumeBase24h: Number(tickerInfo.baseVolume),
      volumeQuote24h: tickerInfo.quoteVolume
        ? Number(tickerInfo.quoteVolume)
        : null,
      lastPrice: Number(tickerInfo.last),
    },
  };

  for (const ask of book.asks) {
    orderBook.asks.push({
      price: Number(ask[0]),
      amount: Number(ask[1]),
    });
  }
  for (const bid of book.bids) {
    orderBook.bids.push({
      price: Number(bid[0]),
      amount: Number(bid[1]),
    });
  }
  return orderBook;
}

function getOHLCVPromiseObject(input: z.infer<typeof OHLCVInputSchema>) {
  const { exchange, ticker, timeframe, since } = input;
  let exchangeInstance = getExchangeInstance(exchange);
  return {
    ohlcvPromise: exchangeInstance.fetchOHLCV(ticker, timeframe, since),
    tickerInfoPromise: exchangeInstance.fetchTicker(ticker),
  };
}

function parseOHLCVResult(
  data: OHLCV[],
  tickerInfo: Ticker,
  input: z.infer<typeof OHLCVInputSchema>
): TOHLCVResult {
  return {
    data: data.map((item) => ({
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
      volume: Number(item[5]),
      timestamp: Number(item[0]),
    })),
    metadata: {
      exchange: input.exchange,
      ticker: input.ticker,
      currentPrice: Number(tickerInfo.last),
    },
  };
}
