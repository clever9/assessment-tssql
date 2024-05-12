import { db, schema } from "../../../db/client";
import { trpcError } from "../../../trpc/core";
import { eq } from "drizzle-orm";

function dateDiffInDays(today: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffInMs = today.getTime() - endDate.getTime();
  return Math.round(diffInMs / oneDay);
}

export const calculateUpgradeCost = async (
  newPlanId: number,
  activationId: number
) => {
  const activation = await db.query.subscriptionActivations.findFirst({
    where: eq(schema.subscriptionActivations.id, activationId),
    with: { subscription: { with: { plan: true } } },
  });

  if (!activation) {
    throw new trpcError({
      code: "NOT_FOUND",
      message: "Couldn't find activation",
    });
  }

  const cPlan = activation.subscription.plan;
  const nPlan = await db.query.plans.findFirst({
    where: eq(schema.plans.id, newPlanId),
  });

  if (!nPlan) {
    throw new trpcError({
      code: "NOT_FOUND",
      message: "Can't find the new plan",
    });
  } else if (cPlan.price > nPlan.price) {
    throw new trpcError({
      code: "BAD_REQUEST",
      message: "Can't upgrade to a lower plan",
    });
  }

  const today = new Date();
  const endDate = new Date(`${activation.endDate}`);
  const remainingDays = dateDiffInDays(today, endDate);

  const pricePerDay = cPlan.price > 0 ? (cPlan.price / 30).toFixed(2) : "0";
  const deductionAmount = (remainingDays * parseFloat(pricePerDay)).toFixed(2);

  if (remainingDays < 1) {
    return {
      upgradeCost: nPlan.price,
    };
  }

  return {
    upgradeCost: (nPlan.price - parseFloat(deductionAmount)).toFixed(2),
  };
};
