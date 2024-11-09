"use client";

import NBCard from "@/components/cards/nb-card";
import { defaultQueryOptions } from "@/lib/constants";
import { TNBAccount } from "@/server/api/routers/nano-ban/types";
import { api } from "@/trpc/react";

export const items: TNBAccount[] = [
  {
    address: "ban_1defi11tou1nbhyp8y4onwsiq5jcur19xe54mcmew1xonnz6e1d1sw74yefu",
    isMine: false,
  },
];

export const nbQueryInput = {
  accounts: items,
};

export default function NBCards() {
  const { data, isPending, isRefetching, isError, isLoadingError } =
    api.nanoBan.getBalances.useQuery(nbQueryInput, defaultQueryOptions.fast);

  return (
    <>
      {items.map((item, index) => (
        <NBCard
          key={item.address + index}
          config={item}
          data={data?.[index]}
          isPending={isPending}
          isRefetching={isRefetching}
          isLoadingError={isLoadingError}
          isError={isError}
        />
      ))}
    </>
  );
}