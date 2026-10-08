export type HpTier = "healthy" | "wounded" | "bloodied" | "critical" | "down";

/** HP bar color band: >50% healthy, 25–50% wounded, 10–25% bloodied, <10% critical, 0 down. */
export function hpTier(current: number, max: number): HpTier {
  if (current <= 0) return "down";
  const p = max > 0 ? current / max : 1;
  if (p > 0.5) return "healthy";
  if (p >= 0.25) return "wounded";
  if (p >= 0.1) return "bloodied";
  return "critical";
}
