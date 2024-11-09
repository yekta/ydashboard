"use client";

import NBCard from "@/components/cards/nb-card";
import { defaultQueryOptions } from "@/lib/constants";
import { TNBAccount } from "@/server/api/routers/nano-ban/types";
import { api } from "@/trpc/react";

export const items: TNBAccount[] = (
  process.env.NEXT_PUBLIC_ADMIN_NB_CARDS || ""
)
  .split(",")
  .map((i) => {
    const [address, isMine] = i.split(":");
    return {
      address,
      isMine: isMine === "true",
    };
  });

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