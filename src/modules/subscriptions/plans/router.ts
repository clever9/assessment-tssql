import {
  router,
  trpcError,
  protectedProcedure,
  publicProcedure,
} from "../../../trpc/core";
import { z } from "zod";
import { schema, db } from "../../../db/client";
import { eq } from "drizzle-orm";
import { calculateUpgradeCost } from "./model";

type User = {
  name: string;
  id: number;
  email: string;
  hashedPassword: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  locale: string;
  timezone: string | null;
  isAdmin: boolean;
};

export const plans = router({
  getOne: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const { id } = input;
        const plan = await db.query.plans.findFirst({
          where: eq(schema.plans.id, id),
        });

        if (!plan) {
          throw new trpcError({
            code: "NOT_FOUND",
            message: "Couldn't find plan",
          });
        }

        return plan;
      } catch (error) {
        console.error("Error fetching plans", error);
        return [];
      }
    }),
  get: publicProcedure.query(async () => {
    try {
      const plans = await db.query.plans.findMany();

      return plans;
    } catch (error) {
      console.error("Error fetching plans", error);
      return [];
    }
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string(), price: z.number() }))
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { name, price } = input;

      const cUser = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });

      if (!(cUser as User).isAdmin) {
        throw new trpcError({
          code: "UNAUTHORIZED",
          message: "Unauthorized access",
        });
      }

      try {
        await db
          .insert(schema.plans)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            name,
            price,
          })
          .returning();

        return {
          success: true,
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
        };
      }
    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string(), price: z.number() }))
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { id, name, price } = input;

      const cUser = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });

      if (!(cUser as User).isAdmin) {
        throw new trpcError({
          code: "UNAUTHORIZED",
          message: "Unauthorized access",
        });
      }

      try {
        await db
          .update(schema.plans)
          .set({
            name,
            price,
            updatedAt: new Date(),
          })
          .where(eq(schema.plans.id, id));
        return {
          success: true,
        };
      } catch (error) {
        console.log(error);
        return {
          success: false,
        };
      }
    }),
  upgradePlan: protectedProcedure
    .input(z.object({ newPlanId: z.number(), subscriptionId: z.number() }))
    .mutation(async ({ ctx: { user }, input }) => {
      const { newPlanId, subscriptionId } = input;
      const { userId } = user;

      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId),
        with: { activation: true, team: true, plan: true },
      });

      if (!subscription) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "Couldn't find this subscription",
        });
      }

      if (subscription.team.userId !== userId) {
        throw new trpcError({
          code: "UNAUTHORIZED",
          message: "Unauthorized access",
        });
      } else if (!subscription.activationId) {
        throw new trpcError({
          code: "BAD_REQUEST",
          message: "Only active subscriptions can be upgraded",
        });
      }
      const cost = await calculateUpgradeCost(
        newPlanId,
        subscription.activationId
      );

      try {
        await db
          .update(schema.subscriptions)
          .set({
            planId: newPlanId,
            activationId: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.subscriptions.id, subscription.id));

        await db.insert(schema.orders).values({
          createdAt: new Date(),
          updatedAt: new Date(),
          subscriptionId: subscriptionId,
          duePayment: parseFloat(`${cost.upgradeCost}`),
        });

        return {
          success: true,
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
        };
      }
    }),
});
