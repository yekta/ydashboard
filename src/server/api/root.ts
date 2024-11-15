import { cmcRouter } from "@/server/api/routers/cmc/router";
import { coinGeckoRouter } from "@/server/api/routers/coin-gecko/router";
import { ethereumRouter } from "@/server/api/routers/ethereum/router";
import { exchangeRouter } from "@/server/api/routers/exchange/router";
import { nanoBananoRouter } from "@/server/api/routers/nano-banano/router";
import { turkishLiraRouter } from "@/server/api/routers/turkish-lira/router";
import { uniswapRouter } from "@/server/api/routers/uniswap/router";
import { wbanRouter } from "@/server/api/routers/wban/router";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import {
  inferReactQueryProcedureOptions,
  TRPCClientErrorLike,
} from "@trpc/react-query";
import { UseTRPCQueryResult } from "@trpc/react-query/shared";
import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  exchange: exchangeRouter,
  nanoBanano: nanoBananoRouter,
  cmc: cmcRouter,
  turkishLira: turkishLiraRouter,
  wban: wbanRouter,
  coinGecko: coinGeckoRouter,
  uniswap: uniswapRouter,
  ethereum: ethereumRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
export type AppRouterReactQueryOptions =
  inferReactQueryProcedureOptions<AppRouter>;
export type AppRouterInputs = inferRouterInputs<AppRouter>;
export type AppRouterOutputs = inferRouterOutputs<AppRouter>;

export type AppRouterQueryResult<Output> = UseTRPCQueryResult<
  Output,
  TRPCClientErrorLike<AppRouter>
>;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
