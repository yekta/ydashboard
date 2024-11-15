"use client";

import CardWrapper from "@/components/cards/card-wrapper";
import Indicator from "@/components/cards/indicator";
import { useCmcGlobalMetrics } from "@/components/providers/cmc/cmc-global-metrics-provider";
import { linearInterpolation } from "@/lib/helpers";
import { formatNumberTBMK } from "@/lib/number-formatters";
import { cn } from "@/lib/utils";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import Link from "next/link";

export default function FearGreedIndexCard({
  className,
}: {
  className?: string;
}) {
  const {
    data,
    isPending,
    isRefetching,
    isError,
    isLoadingError,
    convertCurrency,
  } = useCmcGlobalMetrics();

  const isMarketCapChangePositive = data
    ? data.total_market_cap_yesterday_percentage_change > 0
    : undefined;
  const isMarketCapChangeNegative = data
    ? data.total_market_cap_yesterday_percentage_change < 0
    : undefined;

  const MarketCapChangeIcon =
    isMarketCapChangePositive === true
      ? ArrowUpIcon
      : isMarketCapChangeNegative === true
        ? ArrowDownIcon
        : ArrowRightIcon;

  return (
    <CardWrapper
      href={"https://coinmarketcap.com/charts/fear-and-greed-index"}
      className={cn("w-1/2 md:w-1/3 xl:w-1/4 h-32", className)}
    >
      <div
        data-is-loading-error={(isLoadingError && true) || undefined}
        data-is-pending={(isPending && true) || undefined}
        className="flex flex-1 flex-col justify-center items-center border rounded-xl px-3 py-1 text-center gap-3 group not-touch:group-hover/card:bg-background-secondary relative overflow-hidden
        group-active/card:bg-background-secondary"
      >
        <div className="max-w-full items-center justify-center flex flex-col gap-2.5">
          <Gauge isPending={isPending} data={data} />
          {/* Market cap */}
          <div className="w-full flex items-center justify-center gap-1 text-sm">
            <p className="shrink font-bold min-w-0 overflow-hidden overflow-ellipsis text-center leading-none group-data-[is-pending]:font-normal group-data-[is-pending]:bg-foreground group-data-[is-loading-error]:text-destructive group-data-[is-pending]:text-transparent group-data-[is-pending]:rounded-sm group-data-[is-pending]:animate-skeleton">
              {isPending
                ? "Loading"
                : data
                  ? `${convertCurrency.symbol}${formatNumberTBMK(
                      data.total_market_cap,
                      3
                    )}`
                  : "Error"}
            </p>
            <div className="shrink min-w-0 overflow-hidden text-center leading-none group-data-[is-pending]:bg-foreground group-data-[is-loading-error]:text-destructive group-data-[is-pending]:text-transparent group-data-[is-pending]:rounded-sm group-data-[is-pending]:animate-skeleton">
              <div
                data-is-negative={isMarketCapChangeNegative ? true : undefined}
                data-is-positive={isMarketCapChangePositive ? true : undefined}
                className="flex shrink min-w-0 overflow-hidden overflow-ellipsis items-center justify-start text-muted-foreground group-data-[is-loading-error]:text-destructive data-[is-negative]:text-destructive data-[is-positive]:text-success"
              >
                {!isPending && data && (
                  <MarketCapChangeIcon className="size-4 shrink-0 -my-0.5 group-data-[is-pending]:text-transparent" />
                )}
                <p className="shrink min-w-0 overflow-hidden overflow-ellipsis leading-none group-data-[is-pending]:text-transparent">
                  {isPending
                    ? "Loading"
                    : data
                      ? formatNumberTBMK(
                          data.total_market_cap_yesterday_percentage_change,
                          3,
                          false,
                          true
                        )
                      : "Error"}
                </p>
              </div>
            </div>
          </div>
        </div>
        <Indicator
          isError={isError}
          isPending={isPending}
          isRefetching={isRefetching}
          hasData={data !== undefined}
        />
      </div>
    </CardWrapper>
  );
}

function Gauge({
  lineCount = 8,
  lineWidth = 4,
  gaugeRingWidth = 2,
  circleWidth = 8,
  data,
  isPending,
}: {
  lineWidth?: number;
  lineCount?: number;
  gaugeRingWidth?: number;
  circleWidth?: number;
  data: ReturnType<typeof useCmcGlobalMetrics>["data"];
  isPending: boolean;
}) {
  const value = data ? data.fear_greed_index.value : undefined;
  const adjustedValue =
    value !== undefined ? Math.min(Math.max(0, value), 100) : 50;
  return (
    <div className="w-22 max-w-full flex items-center justify-center relative z-0">
      <div className="w-full h-full absolute left-0 top-0 z-0">
        <div className="w-full h-full absolute left-0 top-0 overflow-hidden">
          <div
            className="w-full aspect-square absolute left-0 top-0 rounded-full
            bg-gradient-to-r from-index-fear via-index-neutral to-index-greed
            group-data-[is-pending]:from-foreground group-data-[is-pending]:via-foreground group-data-[is-pending]:to-foreground group-data-[is-pending]:animate-skeleton
            group-data-[is-loading-error]:from-destructive group-data-[is-loading-error]:via-destructive group-data-[is-loading-error]:to-destructive"
          >
            <div
              style={{
                padding: gaugeRingWidth,
              }}
              className="w-full h-full"
            >
              <div className="w-full h-full rounded-full bg-background not-touch:group-hover:bg-background-secondary group-active:bg-background-secondary" />
            </div>
          </div>
        </div>
        <div className="w-full h-full absolute overflow-hidden">
          <div className="w-full aspect-square left-0 top-0 absolute flex items-center justify-center">
            {Array.from({ length: lineCount }).map((_, i) => {
              const slice = 180 / lineCount;
              const rotation = slice / 2 + (180 / lineCount) * i;
              return (
                <div
                  key={i}
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    width: `calc(100% + ${lineWidth}px)`,
                    height: lineWidth,
                  }}
                  className="flex justify-start not-touch:group-hover:bg-background-secondary group-active:bg-background-secondary bg-background items-center z-20 absolute"
                />
              );
            })}
          </div>
        </div>
        <div className="w-full aspect-square left-0 top-0 absolute flex items-center justify-center">
          <div
            style={{
              transform: `rotate(${linearInterpolation(
                adjustedValue,
                [0, 100],
                [0, 180]
              )}deg)`,
              width: `calc(100% - ${gaugeRingWidth}px + ${circleWidth}px)`,
            }}
            className="flex justify-start items-center z-20 absolute rounded-full transition-transform"
          >
            <div className="bg-background ring-4 ring-background not-touch:group-hover:ring-background-secondary group-active:ring-background-secondary group-active:bg-background-secondary not-touch:group-hover:bg-background-secondary rounded-full">
              <div
                style={{
                  width: circleWidth,
                  height: circleWidth,
                }}
                className="bg-foreground group-data-[is-loading-error]:bg-destructive rounded-full group-data-[is-pending]:animate-skeleton"
              />
            </div>
          </div>
        </div>
      </div>
      {/* Value and description */}
      <div className="max-w-full z-10 pt-3.75 flex items-center justify-center flex-col gap-0.5 overflow-hidden">
        {/* Value */}
        <div className="max-w-full px-4 flex items-center justify-center">
          <p
            className="shrink min-w-0 text-center font-bold text-2xl group-data-[is-pending]:bg-foreground leading-none whitespace-nowrap overflow-hidden overflow-ellipsis 
            group-data-[is-loading-error]:text-destructive group-data-[is-pending]:text-transparent group-data-[is-pending]:rounded-md group-data-[is-pending]:animate-skeleton"
          >
            {isPending
              ? "50"
              : adjustedValue
                ? formatNumberTBMK(adjustedValue, 3)
                : "00"}
          </p>
        </div>
        {/* Description */}
        <div className="w-full px-3.5 flex items-center justify-center">
          <p
            className="max-w-full text-xs shrink min-w-0 text-center leading-none whitespace-nowrap overflow-hidden overflow-ellipsis text-foreground 
            group-data-[is-pending]:bg-foreground group-data-[is-loading-error]:text-destructive group-data-[is-pending]:text-transparent group-data-[is-pending]:rounded-sm group-data-[is-pending]:animate-skeleton"
          >
            {isPending
              ? "Loading"
              : data
                ? data.fear_greed_index.value_classification
                : "Error"}
          </p>
        </div>
      </div>
    </div>
  );
}
