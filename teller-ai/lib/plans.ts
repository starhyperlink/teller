export type PlanKey =
  | "free"
  | "pro-monthly"
  | "business-monthly"
  | "pro-yearly"
  | "business-yearly";

export const plans: Record<PlanKey, { name: string; interval: string; usageLimit: number }> = {
  free: { name: "Free", interval: "monthly", usageLimit: 100 },
  "pro-monthly": { name: "Pro", interval: "monthly", usageLimit: 1000 },
  "business-monthly": { name: "Business", interval: "monthly", usageLimit: 5000 },
  "pro-yearly": { name: "Pro", interval: "yearly", usageLimit: 1000 },
  "business-yearly": { name: "Business", interval: "yearly", usageLimit: 5000 },
};

export function getPlanKey(value: unknown): PlanKey | null {
  return typeof value === "string" && value in plans ? (value as PlanKey) : null;
}