"use client";

import { AppRouterOutputs } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/react";
import { usePathname } from "next/navigation";
import React, { createContext, ReactNode, useContext } from "react";

type TDashboardsAutoContext = {
  data: AppRouterOutputs["ui"]["getDashboards"] | undefined;
  isPending: boolean;
  isLoadingError: boolean;
  invalidate: () => Promise<void>;
  isDashboardPath: boolean;
  username?: string;
  dashboardSlug?: string;
};

const DashboardsAutoContext = createContext<TDashboardsAutoContext | null>(
  null
);

type Props = {
  children: ReactNode;
};

export const DashboardsAutoProvider: React.FC<Props> = ({ children }) => {
  const pathname = usePathname();
  const arr = pathname.split("/");
  const username = arr.length > 1 ? pathname.split("/")[1] : undefined;
  const dashboardSlug = arr.length > 2 ? pathname.split("/")[2] : undefined;
  const isDashboardPath = pathname.split("/").length >= 3;

  const utils = api.useUtils();
  const { data, isPending, isLoadingError } = api.ui.getDashboards.useQuery(
    {
      username: username!,
    },
    {
      enabled: isDashboardPath,
    }
  );
  const invalidate = () =>
    utils.ui.getDashboards.invalidate({ username: username! });

  return (
    <DashboardsAutoContext.Provider
      value={{
        data,
        isPending,
        isLoadingError,
        invalidate,
        isDashboardPath,
        username,
        dashboardSlug,
      }}
    >
      {children}
    </DashboardsAutoContext.Provider>
  );
};

export const useDashboardsAuto = () => {
  const context = useContext(DashboardsAutoContext);
  if (!context) {
    throw new Error(
      "DashboardsAutoProvider is required for useDashboardsAuto to work"
    );
  }
  return context;
};

export default DashboardsAutoProvider;
