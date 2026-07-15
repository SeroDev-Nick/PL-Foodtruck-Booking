/**
 * Simple in-memory per-IP rate limit for booking submissions only.
 * Not perfectly reliable across multiple serverless instances (each has its own
 * memory), but proportionate for this app's scale.
 */

type RateEntry = {
  count: number;
  windowStartedAt: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

const hitsByIp = new Map<string, RateEntry>();

export function isBookingSubmitRateLimited(ip: string): boolean {
  const now = Date.now();
  const existing = hitsByIp.get(ip);

  if (!existing || now - existing.windowStartedAt >= WINDOW_MS) {
    hitsByIp.set(ip, { count: 1, windowStartedAt: now });
    return false;
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  existing.count += 1;
  return false;
}
