/**
 * Admin PIN brute-force throttle — keyed per client so one attacker
 * cannot lock out all admin logins.
 */

import { clientKeyFromRequest } from "./client-key";
import {
  clearThrottle,
  recordThrottleFailure,
  throttleBlocked,
} from "./security-throttle";

const PREFIX = "admin-pin:";
const MAX_FAILURES = 5;

let gate: Promise<void> = Promise.resolve();

/** Serialize admin-login critical section in this process. */
export function withAdminLoginGate<T>(fn: () => Promise<T>): Promise<T> {
  const run = gate.then(fn, fn);
  gate = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function keyFor(request: Request): string {
  return PREFIX + clientKeyFromRequest(request);
}

export async function adminLoginBlocked(
  request: Request,
): Promise<{ blocked: true; retryAfterSec: number } | null> {
  return throttleBlocked(keyFor(request));
}

export async function recordAdminLoginFailure(
  request: Request,
): Promise<{ locked: boolean; retryAfterSec: number }> {
  return recordThrottleFailure(keyFor(request), MAX_FAILURES);
}

export async function clearAdminLoginFailures(request: Request) {
  await clearThrottle(keyFor(request));
}
