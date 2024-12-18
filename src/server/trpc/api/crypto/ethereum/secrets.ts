import "server-only";

import { env } from "@/lib/env";
import { Alchemy, Network } from "alchemy-sdk";
import { TEthereumNetwork } from "@/server/trpc/api/crypto/ethereum/constants";

export const ethereumProviders: Record<TEthereumNetwork, Alchemy> = {
  Ethereum: new Alchemy({
    apiKey: env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
    connectionInfoOverrides: {
      skipFetchSetup: true,
    },
  }),
  Arbitrum: new Alchemy({
    apiKey: env.ALCHEMY_API_KEY,
    network: Network.ARB_MAINNET,
    connectionInfoOverrides: {
      skipFetchSetup: true,
    },
  }),
  BSC: new Alchemy({
    apiKey: env.ALCHEMY_API_KEY,
    network: Network.BNB_MAINNET,
    connectionInfoOverrides: {
      skipFetchSetup: true,
    },
  }),
};
