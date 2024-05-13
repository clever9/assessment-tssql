import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "../../db/client";
import { createCaller, createAuthenticatedCaller } from "../helpers/utils";
import { eq } from "drizzle-orm";
import { trpcError } from "../../trpc/core";
import resetDb from "../helpers/resetDb";

describe("plans routes", async () => {
  beforeAll(async () => {
    await resetDb();
  });

  const user = {
    email: "mail@mail.com",
    password: "P@ssw0rd",
    name: "test",
    timezone: "Asia/Riyadh",
    locale: "en",
    emailVerified: true,
  };

  const plan = {
    name: "Basic",
    price: 25,
  };

  it("should create user successfully", async () => {
    const registeredUserRes = await createCaller({}).auth.register(user);
    expect(registeredUserRes.success).toBe(true);
    const userIndb = await db.query.users.findFirst({
      where: eq(schema.users.email, user.email),
    });
    expect(userIndb).toBeDefined();
    expect(userIndb!.email).toBe(user.email);
    expect(userIndb!.name).toBe(user.name);
    expect(userIndb!.hashedPassword).not.toBe(user.password);
    expect(userIndb!.hashedPassword!.length).toBeGreaterThan(0);
    expect(userIndb!.id).toBeDefined();
    expect(userIndb!.createdAt).toBeDefined();
    expect(userIndb!.updatedAt).toBeDefined();
    expect(userIndb!.emailVerified).toBe(false);
  });

  describe("create", async () => {
    it("should throw error on user not admin", async () => {
      const userInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, user.email),
      });

      await expect(
        createAuthenticatedCaller({ userId: userInDb!.id }).plans.create(plan)
      ).rejects.toThrowError(
        new trpcError({
          code: "UNAUTHORIZED",
          message: "Unauthorized access",
        })
      );
    });
    it("should create plan if user is admin", async () => {
      await db
        .update(schema.users)
        .set({ isAdmin: true })
        .where(eq(schema.users.email, user.email));

      const userInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, user.email),
      });

      const createdPlanRes = await createAuthenticatedCaller({
        userId: userInDb!.id,
      }).plans.create(plan);
      expect(createdPlanRes.success).toBe(true);

      const planInDb = await db.query.plans.findFirst({
        where: eq(schema.plans.name, plan.name),
      });
      expect(planInDb).toBeDefined();
      expect(planInDb!.name).toBe(plan.name);
      expect(planInDb!.price).toBe(plan.price);
      expect(planInDb!.id).toBeDefined();
      expect(planInDb!.createdAt).toBeDefined();
      expect(planInDb!.updatedAt).toBeDefined();
    });
  });
  describe("update", async () => {
    it("should throw error on user not admin", async () => {
      await db
        .update(schema.users)
        .set({ isAdmin: false })
        .where(eq(schema.users.email, user.email));

      const userInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, user.email),
      });
      const planInDb = await db.query.plans.findFirst({
        where: eq(schema.plans.name, plan.name),
      });

      const updatedPlan = {
        id: planInDb!.id,
        name: planInDb!.name,
        price: 50,
      };

      await expect(
        createAuthenticatedCaller({ userId: userInDb!.id }).plans.update(
          updatedPlan
        )
      ).rejects.toThrowError(
        new trpcError({
          code: "UNAUTHORIZED",
          message: "Unauthorized access",
        })
      );
    });
    it("should update plan if user is admin", async () => {
      await db
        .update(schema.users)
        .set({ isAdmin: true })
        .where(eq(schema.users.email, user.email));

      const userInDb = await db.query.users.findFirst({
        where: eq(schema.users.email, user.email),
      });
      const planInDb = await db.query.plans.findFirst({
        where: eq(schema.plans.name, plan.name),
      });

      const updatedPlan = {
        id: planInDb!.id,
        name: planInDb!.name,
        price: 50,
      };

      const updatedPlanRes = await createAuthenticatedCaller({
        userId: userInDb!.id,
      }).plans.update(updatedPlan);
      expect(updatedPlanRes.success).toBe(true);

      const updatedPlanInDb = await db.query.plans.findFirst({
        where: eq(schema.plans.name, plan.name),
      });
      expect(updatedPlanInDb).toBeDefined();
      expect(updatedPlanInDb!.id).toBe(updatedPlan.id);
      expect(updatedPlanInDb!.name).toBe(updatedPlan.name);
      expect(updatedPlanInDb!.price).toBe(updatedPlan.price);
    });
  });
  describe("get", async () => {
    it("should get all plans", async () => {
      const plans = await createCaller({}).plans.get();
      expect(plans.length).toBeGreaterThan(0);
    });
  });
  describe("getOne", async () => {
    it("should get an empty array", async () => {
      const singlePlan = await createCaller({}).plans.getOne({ id: 2 });
      expect(singlePlan).toStrictEqual([]);
    });
    it("should fetch a single plan", async () => {
      const planInDb = await db.query.plans.findFirst({
        where: eq(schema.plans.name, plan.name),
      });
      const singlePan = await createCaller({}).plans.getOne({
        id: planInDb!.id,
      });
      expect(singlePan).toBeDefined();
    });
  });
});
