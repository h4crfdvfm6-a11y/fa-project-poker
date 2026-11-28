/**
 * Account sign-in brute-force throttle.
 * Per-client key (trusted proxy IP or rl_cid cookie) + a global ceiling so
 * header or cookie rotation cannot make unlimited password guesses.
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

const CLIENT_PREFIX = "account-login:";
const GLOBAL_KEY = "account-login:global";
const CLIENT_MAX = 8;
/** Generous ceiling so a shared network (a club's Wi-Fi) is not locked out. */
const GLOBAL_MAX = 300;

let gate: Promise<void> = Promise.resolve();

/** Serialize the sign-in critical section in this process. */
export function withAccountLoginGate<T>(fn: () => Promise<T>): Promise<T> {
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

export async function accountLoginGateState(request: Request): Promise<{
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

export async function recordAccountLoginFailure(
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

export async function clearAccountLoginFailures(
  request: Request,
  id?: ThrottleIdentity,
) {
  const ident = id ?? identity(request);
  await clearThrottle(clientKey(ident));
}
