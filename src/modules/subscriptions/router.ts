import {
  router,
  trpcError,
  protectedProcedure,
  publicProcedure,
} from "../../trpc/core";
import { z } from "zod";
import { schema, db } from "../../db/client";
import { eq } from "drizzle-orm";

export const subscriptions = router({
  getOne: publicProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const { subscriptionId } = input;
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId),
      });

      if (!subscription) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }
      return subscription;
    }),
  get: publicProcedure.query(async () => {
    try {
      const subscriptions = await db.query.subscriptions.findMany({
        with: { activation: true, plan: true, team: true },
      });

      return subscriptions;
    } catch (error) {
      console.error("Error fetching subscriptions", error);
      return [];
    }
  }),
  create: protectedProcedure
    .input(z.object({ planId: z.number(), teamId: z.number() }))
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { planId, teamId } = input;

      const team = await db.query.teams.findFirst({
        where: eq(schema.teams.id, teamId),
      });
      const plan = await db.query.plans.findFirst({
        where: eq(schema.plans.id, planId),
      });

      if (!team) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "Couldn't find this team",
        });
      }
      if (!plan) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "Couldn't find this plan",
        });
      }

      if (team.userId !== userId) {
        throw new trpcError({
          code: "UNAUTHORIZED",
        });
      }

      try {
        await db
          .insert(schema.subscriptions)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            planId: plan.id,
            teamId: team.id,
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
    .input(
      z.object({
        id: z.number(),
        activationId: z.number(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { id, isActive, activationId } = input;

      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, id),
        with: { activation: true, plan: true, team: true },
      });

      if (!subscription) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      } else if (subscription.team.userId !== userId) {
        throw new trpcError({
          code: "UNAUTHORIZED",
          message: "Unauthorized access",
        });
      }

      try {
        await db
          .update(schema.subscriptions)
          .set({
            isActive,
            activationId,
          })
          .where(eq(schema.subscriptions.id, id));
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
  createActivation: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        subscriptionId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { startDate, endDate, subscriptionId } = input;

      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId),
      });

      if (!subscription) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      try {
        await db
          .insert(schema.subscriptionActivations)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            startDate,
            endDate,
            subscriptionId,
          })
          .returning();
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
  updateActivation: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        startDate: z.date(),
        endDate: z.date(),
        subscriptionId: z.number(),
      })
    )
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { id, startDate, endDate, subscriptionId } = input;

      const activation = await db.query.subscriptionActivations.findFirst({
        where: eq(schema.subscriptionActivations.id, id),
        with: { subscription: { with: { team: true } } },
      });

      if (!activation) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "activation not found",
        });
      } else if (activation.subscription.team.userId !== userId) {
        throw new trpcError({
          code: "UNAUTHORIZED",
          message: "Unauthorized access",
        });
      }

      try {
        await db
          .update(schema.subscriptionActivations)
          .set({
            startDate,
            endDate,
            subscriptionId,
            updatedAt: new Date(),
          })
          .where(eq(schema.subscriptionActivations.id, id));
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
  createOrder: publicProcedure // will be called by background cron job
    .input(
      z.object({
        duePayment: z.number(),
        subscriptionId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { duePayment, subscriptionId } = input;

      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId),
      });

      if (!subscription) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      try {
        await db
          .insert(schema.orders)
          .values({
            createdAt: new Date(),
            updatedAt: new Date(),
            subscriptionId,
            duePayment,
          })
          .returning();
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
  updateOrder: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        duePayment: z.number(),
        status: z.enum(["PENDING", "PAID"]),
        subscriptionId: z.number(),
      })
    )
    .mutation(async ({ ctx: { user }, input }) => {
      const { userId } = user;
      const { id, duePayment, status, subscriptionId } = input;

      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId),
        with: { plan: true, team: true, activation: true },
      });

      const order = await db.query.orders.findFirst({
        where: eq(schema.orders.id, id),
      });

      if (!subscription) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "subscription not found",
        });
      } else if (subscription.team.userId !== userId) {
        throw new trpcError({
          code: "UNAUTHORIZED",
          message: "Unauthorized access",
        });
      } else if (!order) {
        throw new trpcError({
          code: "NOT_FOUND",
          message: "order not found",
        });
      }

      try {
        await db
          .update(schema.orders)
          .set({
            duePayment,
            status,
            subscriptionId,
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, id));

        // as soon as order is paid, a new subscription activation record is inserted automatically
        if (order.status === "PENDING" && status === "PAID") {
          const { startDate, endDate } = await getActivationPeriod(
            subscription.type
          );
          await db.insert(schema.subscriptionActivations).values({
            createdAt: new Date(),
            updatedAt: new Date(),
            startDate,
            endDate,
            subscriptionId,
          });
        }
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
});

const getActivationPeriod = async (
  type: "YEAR" | "MONTH"
): Promise<{ startDate: Date; endDate: Date }> => {
  const today = new Date();
  let startDate: Date;
  let endDate: Date;

  if (type === "YEAR") {
    startDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    endDate = new Date(
      today.getFullYear() + 1,
      today.getMonth(),
      today.getDate()
    );
  } else if (type === "MONTH") {
    startDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    endDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 31
    );
  } else {
    throw new Error('Invalid type. Only "YEAR" or "MONTH" allowed.');
  }

  return { startDate, endDate };
};
