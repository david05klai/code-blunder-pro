// api/_lib/plans.ts
export type PlanKey =
  | "premium_one_time_6m"
  | "premium_monthly"
  | "premium_yearly";

export type Plan = {
  key: PlanKey;
  title: string;
  currency_id: "COP" | "USD";
  amount: number;
  // Para premium por tiempo:
  durationDays?: number;
  // Para suscripción:
  recurring?: {
    frequency: number;
    frequency_type: "days" | "months";
  };
};

export const PLANS: Record<PlanKey, Plan> = {
  // Pago único que da premium 6 meses (≈180 días)
  premium_one_time_6m: {
    key: "premium_one_time_6m",
    title: "Premium (6 meses)",
    currency_id: "COP",
    amount: 49000,
    durationDays: 180,
  },

  // Suscripción mensual
  premium_monthly: {
    key: "premium_monthly",
    title: "Premium Mensual",
    currency_id: "COP",
    amount: 9900,
    recurring: { frequency: 1, frequency_type: "months" },
  },

  // Suscripción anual
  premium_yearly: {
    key: "premium_yearly",
    title: "Premium Anual",
    currency_id: "COP",
    amount: 99000,
    recurring: { frequency: 12, frequency_type: "months" },
  },
};
