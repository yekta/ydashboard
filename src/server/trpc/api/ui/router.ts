import { z } from "zod";

import { mainDashboardSlug } from "@/lib/constants";
import { getCardTypes } from "@/server/db/repo/card-types";
import {
  createCardValues,
  TInsertCardValue,
} from "@/server/db/repo/card-values";
import {
  createCard,
  deleteCards,
  getCards,
  getMaximumCardXOrder,
  reorderCards,
} from "@/server/db/repo/cards";
import { getCurrencies } from "@/server/db/repo/currencies";
import {
  createDashboard,
  deleteDashboard,
  getDashboard,
  getDashboards,
  getMaximumDashboardXOrder,
  isDashboardSlugAvailable,
  renameDashboard,
  reorderDashboards,
} from "@/server/db/repo/dashboards";
import {
  changeCurrencyPreference,
  changeUsername,
  getOtherUser,
  getUser,
  getUserFull,
  isUsernameAvailable,
} from "@/server/db/repo/users";
import { cleanAndSortArray } from "@/server/redis/cache-utils";
import {
  ChangeCurrencyPreferenceSchemaUI,
  ChangeUsernameSchemaUI,
  CreateCardInputSchema,
  CreateDashboardSchemaUI,
  RenameDashboardSchemaUI,
} from "@/server/trpc/api/ui/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { Session } from "next-auth";
import { db } from "@/server/db/db";
import { cardsTable } from "@/server/db/schema";

function getIsOwner({
  session,
  username,
}: {
  session: Session | null;
  username: string;
}) {
  return session ? session.user.username === username : false;
}

export const uiRouter = createTRPCRouter({
  getDashboard: publicProcedure
    .input(
      z.object({
        username: z.string(),
        dashboardSlug: z.string(),
      })
    )
    .query(async function ({
      input: { username, dashboardSlug },
      ctx: { session },
    }) {
      const isOwner = getIsOwner({ session, username });

      const result = await getDashboard({
        isOwner,
        username,
        dashboardSlug,
      });

      return result;
    }),
  getDashboards: publicProcedure
    .input(
      z.object({
        includeCardCounts: z.boolean().optional().default(false),
        username: z.string(),
      })
    )
    .query(async function ({
      input: { username, includeCardCounts },
      ctx: { session },
    }) {
      const isOwner = getIsOwner({ session, username });

      const result = await getDashboards({
        isOwner,
        username,
        includeCardCounts,
      });

      return {
        dashboards: result,
        isOwner,
      };
    }),
  getCards: publicProcedure
    .input(
      z.object({
        username: z.string(),
        dashboardSlug: z.string(),
      })
    )
    .query(async function ({
      input: { username, dashboardSlug },
      ctx: { session },
    }) {
      const isOwner = getIsOwner({ session, username });

      const [result, dashboard] = await Promise.all([
        getCards({
          isOwner,
          username,
          dashboardSlug,
        }),
        getDashboard({
          isOwner,
          username,
          dashboardSlug,
        }),
      ]);

      let currencyIdsForFetch: string[] = [];
      result.forEach((cardObj, index) => {
        if (cardObj.cardType.id === "calculator") {
          const values = cardObj.values;
          if (!values) return;
          values.forEach((v) => {
            if (v.cardTypeInputId !== "calculator_currency_id") return;
            currencyIdsForFetch.push(v.value);
          });
        }
        if (cardObj.cardType.id === "currency") {
          const values = cardObj.values;
          if (!values) return;
          values.forEach((v) => {
            if (
              v.cardTypeInputId !== "currency_currency_id_base" &&
              v.cardTypeInputId !== "currency_currency_id_quote"
            )
              return;
            currencyIdsForFetch.push(v.value);
          });
        }
      });

      const currencyIdsForFetchFinal = cleanAndSortArray(currencyIdsForFetch);
      const currencies = await getCurrencies({
        ids: currencyIdsForFetchFinal,
      });

      return {
        cards: result,
        currencies,
        dashboard,
      };
    }),
  getCurrencies: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string()).optional(),
        forexOnly: z.boolean().optional().default(false),
      })
    )
    .query(async function ({ input: { ids, forexOnly } }) {
      const res = await getCurrencies({
        ids: ids ? cleanAndSortArray(ids) : undefined,
        forexOnly,
      });
      return res;
    }),
  getCardTypes: publicProcedure
    .input(z.object({}))
    .query(async function ({ input: {} }) {
      const res = await getCardTypes();
      return res;
    }),
  createCard: publicProcedure
    .input(CreateCardInputSchema)
    .mutation(async function ({
      input: {
        cardTypeId,
        dashboardSlug,
        xOrder,
        values,
        xOrderPreference,
        variant,
      },
      ctx: { session },
    }) {
      if (!session?.user) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      // Get the dashboard
      const dashboard = await getDashboard({
        isOwner: true,
        username: session.user.username,
        dashboardSlug,
      });

      if (!dashboard) {
        throw new TRPCError({
          message: "Dashboard not found",
          code: "NOT_FOUND",
        });
      }

      let xOrderSelected = xOrder;
      if (xOrder === undefined && xOrderPreference === "first") {
        xOrderSelected = 0;
      } else if (xOrder === undefined) {
        const maximumXOrder = await getMaximumCardXOrder({
          dashboardId: dashboard.data.dashboard.id,
        });
        xOrderSelected = maximumXOrder + 1;
      }

      if (xOrderSelected === undefined) {
        throw new TRPCError({
          message: "Invalid xOrder",
          code: "BAD_REQUEST",
        });
      }

      const newCardId = crypto.randomUUID();

      await db.transaction(async (tx) => {
        await createCard({
          tx,
          id: newCardId,
          cardTypeId,
          dashboardId: dashboard.data.dashboard.id,
          xOrder: xOrderSelected,
          variant,
        });
        const vals = Object.values(values);
        if (vals.length > 0) {
          let cardValues: TInsertCardValue[] = [];

          for (const [key, v] of Object.entries(values)) {
            cardValues.push({
              cardTypeInputId: key,
              cardId: newCardId,
              value: v.value,
              xOrder: v.xOrder,
            });
          }
          await createCardValues({
            tx,
            cardValues,
          });
        }
      });

      return {
        cardId: newCardId,
        cardTypeId,
      };
    }),
  deleteCards: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string()),
      })
    )
    .mutation(async function ({ input: { ids }, ctx: { session } }) {
      if (!session?.user) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      await deleteCards({ userId: session.user.id, ids });
      return true;
    }),
  reorderCards: publicProcedure
    .input(
      z.object({
        orderObjects: z.array(z.object({ id: z.string(), xOrder: z.number() })),
      })
    )
    .mutation(async function ({ input: { orderObjects }, ctx: { session } }) {
      if (!session?.user) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      const res = await reorderCards({ userId: session.user.id, orderObjects });
      return res;
    }),
  createDashboard: publicProcedure
    .input(
      z.object({
        ...CreateDashboardSchemaUI.shape,
        icon: z.string().optional(),
        xOrder: z.number().optional(),
      })
    )
    .mutation(async function ({
      input: { title, icon, xOrder },
      ctx: { session },
    }) {
      if (!session?.user) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      let slug = slugify(title);
      const [isAvailable, maximumXOrder] = await Promise.all([
        isDashboardSlugAvailable({
          slug,
          userId: session.user.id,
        }),
        getMaximumDashboardXOrder({ userId: session.user.id }),
      ]);

      if (!isAvailable) {
        slug = addRandomStringToSlug(slug);
      }

      const dashboardId = await createDashboard({
        userId: session.user.id,
        slug,
        title,
        icon,
        xOrder: xOrder !== undefined ? xOrder : maximumXOrder + 1,
      });

      return {
        dashboardId,
        slug,
        title,
        username: session.user.username,
      };
    }),
  renameDashboard: publicProcedure
    .input(
      z.object({
        ...RenameDashboardSchemaUI.shape,
        slug: z.string(),
      })
    )
    .mutation(async function ({ input: { title, slug }, ctx: { session } }) {
      if (!session || session.user.id === undefined) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      if (slug === mainDashboardSlug) {
        const result = await renameDashboard({
          title: title,
          currentSlug: mainDashboardSlug,
          newSlug: mainDashboardSlug,
          userId: session.user.id,
        });
        return {
          slug: result.slug,
          title: result.title,
          username: session.user.username,
        };
      }

      let newSlug = slugify(title);
      const isAvailable = await isDashboardSlugAvailable({
        slug: newSlug,
        userId: session.user.id,
      });
      if (!isAvailable) {
        newSlug = addRandomStringToSlug(newSlug);
      }

      const result = await renameDashboard({
        title: title,
        currentSlug: slug,
        newSlug: newSlug,
        userId: session.user.id,
      });

      return {
        slug: result.slug,
        title: result.title,
        username: session.user.username,
      };
    }),
  deleteDashboard: publicProcedure
    .input(
      z.object({
        slug: z.string(),
      })
    )
    .mutation(async function ({ input: { slug }, ctx: { session } }) {
      if (!session || session.user.id === undefined) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      if (slug === mainDashboardSlug) {
        throw new TRPCError({
          message: "Cannot delete the main dashboard.",
          code: "BAD_REQUEST",
        });
      }
      await deleteDashboard({
        userId: session.user.id,
        slug,
      });
      return {
        username: session.user.username,
        slug,
      };
    }),
  reorderDashboards: publicProcedure
    .input(
      z.object({
        orderObjects: z.array(z.object({ id: z.string(), xOrder: z.number() })),
      })
    )
    .mutation(async function ({ input: { orderObjects }, ctx: { session } }) {
      if (!session?.user) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      const res = await reorderDashboards({
        userId: session.user.id,
        orderObjects,
      });
      return res;
    }),
  getUser: publicProcedure.query(async function ({ ctx: { session } }) {
    if (!session || session.user.id === undefined) {
      return null;
    }
    const user = await getUser({ userId: session.user.id });
    return user;
  }),
  getUserFull: publicProcedure.query(async function ({ ctx: { session } }) {
    if (!session || session.user.id === undefined) {
      return null;
    }
    const user = await getUserFull({ userId: session.user.id });
    return user;
  }),
  getOtherUser: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async function ({ input: { username } }) {
      const user = await getOtherUser({ username });
      return user;
    }),
  changeUsername: publicProcedure
    .input(z.object({ ...ChangeUsernameSchemaUI.shape }))
    .mutation(async function ({ input: { newUsername }, ctx: { session } }) {
      if (!session || session.user.id === undefined) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      const isAvailable = await isUsernameAvailable(newUsername);
      if (!isAvailable) {
        throw new TRPCError({
          message: "This username is not available.",
          code: "BAD_REQUEST",
        });
      }
      const result = await changeUsername({
        userId: session.user.id,
        newUsername,
      });
      return result;
    }),
  changeCurrencyPreference: publicProcedure
    .input(z.object({ ...ChangeCurrencyPreferenceSchemaUI.shape }))
    .mutation(async function ({
      input: { primaryCurrencyId, secondaryCurrencyId, tertiaryCurrencyId },
      ctx: { session },
    }) {
      if (!session || session.user.id === undefined) {
        throw new TRPCError({
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }
      if (
        primaryCurrencyId === secondaryCurrencyId ||
        primaryCurrencyId === tertiaryCurrencyId ||
        secondaryCurrencyId === tertiaryCurrencyId
      ) {
        throw new TRPCError({
          message: "Currencies must be different.",
          code: "BAD_REQUEST",
        });
      }
      const currencies = await getCurrencies({
        ids: [primaryCurrencyId, secondaryCurrencyId, tertiaryCurrencyId],
      });

      if (currencies.length !== 3) {
        throw new TRPCError({
          message: "One of the currency IDs is wrong.",
          code: "BAD_REQUEST",
        });
      }

      if (currencies.some((c) => c.isCrypto)) {
        throw new TRPCError({
          message: "All currencies must be fiat currencies.",
          code: "BAD_REQUEST",
        });
      }

      const result = await changeCurrencyPreference({
        userId: session.user.id,
        primaryCurrencyId,
        secondaryCurrencyId,
        tertiaryCurrencyId,
      });
      return result;
    }),
});

function slugify(str: string) {
  return (
    str
      .toLowerCase()
      .trim()
      // First remove anything that isn't alphanumeric or spaces
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      // Replace multiple spaces with single space
      .replace(/\s+/g, " ")
      // Then replace spaces with hyphens
      .replace(/ /g, "-")
  );
}

function addRandomStringToSlug(slug: string) {
  const uuid = crypto.randomUUID();
  return `${slug}-${uuid.slice(0, 4)}`;
}
