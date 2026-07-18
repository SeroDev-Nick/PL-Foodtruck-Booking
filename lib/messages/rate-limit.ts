/**
 * Simple in-memory per-IP rate limit for message submissions.
 * Separate from booking rate limits so the two flows do not share counters.
 */

type RateEntry = {
  count: number;
  windowStartedAt: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

const hitsByIp = new Map<string, RateEntry>();

export function isMessageSubmitRateLimited(ip: string): boolean {
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
