/**
 * Club invite guess throttle — keyed per client so one attacker
 * cannot lock out all new joins.
 */

import { clientKeyFromRequest } from "./client-key";
import {
  clearThrottle,
  recordThrottleFailure,
  throttleBlocked,
} from "./security-throttle";

const PREFIX = "club-invite:";
const MAX_FAILURES = 10;

function keyFor(request: Request): string {
  return PREFIX + clientKeyFromRequest(request);
}

export async function inviteGuessBlocked(
  request: Request,
): Promise<{ blocked: true; retryAfterSec: number } | null> {
  return throttleBlocked(keyFor(request));
}

export async function recordInviteGuessFailure(
  request: Request,
): Promise<{ locked: boolean; retryAfterSec: number }> {
  return recordThrottleFailure(keyFor(request), MAX_FAILURES);
}

export async function clearInviteGuessFailures(request: Request) {
  await clearThrottle(keyFor(request));
}
