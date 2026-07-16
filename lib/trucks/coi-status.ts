import { addDays, format, parseISO } from "date-fns";

export type CoiUrgency = "ok" | "expiring_soon" | "expired";

/**
 * Live COI status from expiration date vs today — no stored flag.
 * Expired: before today. Expiring soon: today through today+30 days inclusive.
 */
export function resolveCoiUrgency(
  expirationDate: string,
  todayIso: string,
): CoiUrgency {
  if (expirationDate < todayIso) {
    return "expired";
  }
  const soonCutoff = format(addDays(parseISO(todayIso), 30), "yyyy-MM-dd");
  if (expirationDate <= soonCutoff) {
    return "expiring_soon";
  }
  return "ok";
}

export function coiUrgencyLabel(urgency: CoiUrgency): string | null {
  switch (urgency) {
    case "expired":
      return "Expired";
    case "expiring_soon":
      return "Expires within 30 days";
    case "ok":
      return null;
  }
}
