/**
 * Admin PIN brute-force throttle.
 * Per-client key (trusted proxy IP or rl_cid cookie) + global ceiling so
 * header/cookie rotation cannot unlimited-guess the PIN.
 */

import {
  throttleIdentityFromRequest,
  type ThrottleIdentity,
} from "./client-key";
import {
  clearThrottle,
  recordThrottleFailure,
  throttleBlocked,
} from "./security-throttle";

const CLIENT_PREFIX = "admin-pin:";
const GLOBAL_KEY = "admin-pin:global";
const CLIENT_MAX = 5;
/** Caps mass guessing even when client keys are rotated. */
const GLOBAL_MAX = 40;

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

function identity(request: Request): ThrottleIdentity {
  return throttleIdentityFromRequest(request);
}

function clientKey(id: ThrottleIdentity): string {
  return CLIENT_PREFIX + id.key;
}

export async function adminLoginGateState(request: Request): Promise<{
  blocked: { retryAfterSec: number } | null;
  setCookie?: string;
  identity: ThrottleIdentity;
}> {
  const id = identity(request);
  const global = await throttleBlocked(GLOBAL_KEY);
  if (global) {
    return { blocked: global, setCookie: id.setCookie, identity: id };
  }
  const client = await throttleBlocked(clientKey(id));
  if (client) {
    return { blocked: client, setCookie: id.setCookie, identity: id };
  }
  return { blocked: null, setCookie: id.setCookie, identity: id };
}

export async function recordAdminLoginFailure(
  request: Request,
  id?: ThrottleIdentity,
): Promise<{ locked: boolean; retryAfterSec: number; setCookie?: string }> {
  const ident = id ?? identity(request);
  const global = await recordThrottleFailure(GLOBAL_KEY, GLOBAL_MAX);
  const client = await recordThrottleFailure(clientKey(ident), CLIENT_MAX);
  const locked = global.locked || client.locked;
  const retryAfterSec = Math.max(global.retryAfterSec, client.retryAfterSec);
  return { locked, retryAfterSec, setCookie: ident.setCookie };
}

export async function clearAdminLoginFailures(
  request: Request,
  id?: ThrottleIdentity,
) {
  const ident = id ?? identity(request);
  await clearThrottle(clientKey(ident));
}
