/**
 * Club invite guess throttle — per-client + global ceiling.
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

const CLIENT_PREFIX = "club-invite:";
const GLOBAL_KEY = "club-invite:global";
const CLIENT_MAX = 10;
const GLOBAL_MAX = 80;

function identity(request: Request): ThrottleIdentity {
  return throttleIdentityFromRequest(request);
}

function clientKey(id: ThrottleIdentity): string {
  return CLIENT_PREFIX + id.key;
}

export async function inviteGateState(request: Request): Promise<{
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

export async function recordInviteGuessFailure(
  request: Request,
  id?: ThrottleIdentity,
): Promise<{ locked: boolean; retryAfterSec: number; setCookie?: string }> {
  const ident = id ?? identity(request);
  const global = await recordThrottleFailure(GLOBAL_KEY, GLOBAL_MAX);
  const client = await recordThrottleFailure(clientKey(ident), CLIENT_MAX);
  return {
    locked: global.locked || client.locked,
    retryAfterSec: Math.max(global.retryAfterSec, client.retryAfterSec),
    setCookie: ident.setCookie,
  };
}

export async function clearInviteGuessFailures(
  request: Request,
  id?: ThrottleIdentity,
) {
  const ident = id ?? identity(request);
  await clearThrottle(clientKey(ident));
}
