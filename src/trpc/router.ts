import { router } from "./core";

import { auth } from "../modules/auth/router";
import { account } from "../modules/users/router";
import { teams } from "../modules/teams/router";
import { subscriptions } from "../modules/subscriptions/router";
import { plans } from "../modules/subscriptions/plans/router";

export const appRouter = router({
  auth,
  // protected
  account,
  teams,
  plans,
  subscriptions,
});

export type AppRouter = typeof appRouter;
