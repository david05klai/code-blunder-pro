type PlanKey = "PREMIUM_MONTHLY" | "PREMIUM_ANNUAL" | "API_MONTHLY" | "API_ANNUAL";

export function mpAccessToken() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("Missing MP_ACCESS_TOKEN");
  return t;
}

export function appBaseUrl() {
  const u = process.env.APP_BASE_URL;
  if (!u) throw new Error("Missing APP_BASE_URL");
  return u.replace(/\/+$/, "");
}

export function webhookSecret() {
  const s = process.env.MP_WEBHOOK_SECRET;
  if (!s) throw new Error("Missing MP_WEBHOOK_SECRET");
  return s;
}

export function planIdFor(plan: PlanKey) {
  const map: Record<PlanKey, string | undefined> = {
    PREMIUM_MONTHLY: process.env.MP_PLAN_PREMIUM_MONTHLY,
    PREMIUM_ANNUAL: process.env.MP_PLAN_PREMIUM_ANNUAL,
    API_MONTHLY: process.env.MP_PLAN_API_MONTHLY,
    API_ANNUAL: process.env.MP_PLAN_API_ANNUAL,
  };
  const id = map[plan];
  if (!id) throw new Error(`Missing plan env var for ${plan}`);
  return id;
}

export type { PlanKey };
