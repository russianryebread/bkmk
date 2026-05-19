// Simple in-memory sliding-window rate limiter.
//
// This is process-local: it works for a single-instance deployment and is
// sufficient to slow down credential-stuffing / brute-force attempts. For a
// multi-instance deployment, swap the Map for a shared store (e.g. Redis).

// key -> sorted list of attempt timestamps (ms epoch)
const attempts = new Map<string, number[]>()

// Drop entries whose windows have fully elapsed so the Map can't grow forever.
function pruneExpired(now: number, windowMs: number): void {
  for (const [key, timestamps] of attempts) {
    const fresh = timestamps.filter(ts => now - ts < windowMs)
    if (fresh.length === 0) {
      attempts.delete(key)
    } else {
      attempts.set(key, fresh)
    }
  }
}

/**
 * Record an attempt for `key` and report whether it is allowed.
 *
 * Returns `{ allowed: true }` when the number of attempts within the trailing
 * `windowMs` window (including this one) does not exceed `maxAttempts`.
 * Attempts that exceed the limit are NOT recorded, so a sustained burst can't
 * keep extending the window indefinitely.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  pruneExpired(now, windowMs)

  const timestamps = (attempts.get(key) ?? []).filter(ts => now - ts < windowMs)

  if (timestamps.length >= maxAttempts) {
    attempts.set(key, timestamps)
    return { allowed: false, remaining: 0 }
  }

  timestamps.push(now)
  attempts.set(key, timestamps)
  return { allowed: true, remaining: maxAttempts - timestamps.length }
}
