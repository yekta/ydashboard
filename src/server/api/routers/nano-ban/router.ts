import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  banAPI,
  isBan,
  isNano,
  nanoAPI,
  rawToBanOrNano,
} from "@/server/api/routers/nano-ban/helpers";
import {
  AccountSchema,
  TNBBalanceResponse,
  TNBResult,
} from "@/server/api/routers/nano-ban/types";

export const nanoBanRouter = createTRPCRouter({
  getBalances: publicProcedure
    .input(
      z.object({
        accounts: z.array(AccountSchema),
      })
    )
    .query(async ({ input: { accounts } }) => {
      const results: TNBResult[] = [];
      const nanoAddresses = accounts
        .map((a) => a.address)
        .filter((a) => isNano(a));
      const banAddresses = accounts
        .map((a) => a.address)
        .filter((a) => isBan(a));

      const nanoBalancesPromise = getBalances({
        addresses: nanoAddresses,
        isNano: true,
      });
      const banBalancesPromise = getBalances({
        addresses: banAddresses,
        isNano: false,
      });

      const [nanoBalances, banBalances] = await Promise.all([
        nanoBalancesPromise,
        banBalancesPromise,
      ]);

      for (const account of accounts) {
        const address = account.address;
        const isMine = account.isMine;
        const isNanoAddress = isNano(address);
        let balanceObj: TNBBalanceResponse["balances"][string] | undefined =
          undefined;

        if (isNanoAddress && address in nanoBalances.balances) {
          balanceObj = nanoBalances.balances[address];
        } else if (!isNanoAddress && address in banBalances.balances) {
          balanceObj = banBalances.balances[address];
        }

        if (!balanceObj) {
          throw new Error("Failed to fetch NANO balances");
        }

        results.push({
          address,
          balance: rawToBanOrNano(balanceObj.balance, isNanoAddress),
          pending: rawToBanOrNano(balanceObj.pending, isNanoAddress),
          receivable: rawToBanOrNano(balanceObj.receivable, isNanoAddress),
          isMine,
        });
      }
      return results;
    }),
});

async function getBalances({
  addresses,
  isNano,
}: {
  addresses: string[];
  isNano?: boolean;
}) {
  const res = await fetch(isNano ? nanoAPI : banAPI, {
    method: "POST",
    body: JSON.stringify({
      action: "accounts_balances",
      accounts: addresses,
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to fetch NANO/BAN balances");
  }
  const json: TNBBalanceResponse = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json;
}