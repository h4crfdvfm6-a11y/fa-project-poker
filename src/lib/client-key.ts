import { randomBytes } from "crypto";

/**
 * Client identity for rate limits.
 *
 * - When TRUSTED_PROXY_HOPS > 0 (default 1): use the X-Forwarded-For hop
 *   appended by the trusted proxy (rightmost), not the client-supplied leftmost.
 * - Otherwise ignore spoofable forwarding headers and partition by an httpOnly
 *   `rl_cid` cookie issued by us.
 *
 * Not authentication — only partitions throttles. Pair with a global ceiling.
 */

const COOKIE = "rl_cid";

export type ThrottleIdentity = {
  /** Stable key segment for security_throttle rows. */
  key: string;
  /** Set-Cookie value when a new rl_cid was minted (attach to response). */
  setCookie?: string;
};

export function throttleIdentityFromRequest(request: Request): ThrottleIdentity {
  const hops = trustedProxyHops();
  if (hops > 0) {
    const fromProxy = ipFromTrustedProxy(request, hops);
    if (fromProxy) return { key: `ip:${fromProxy}` };
  }

  const existing = readCookie(request.headers.get("cookie"), COOKIE);
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) {
    return { key: `c:${existing}` };
  }

  const id = randomBytes(18).toString("base64url");
  const secure =
    (request.headers.get("x-forwarded-proto") || "").includes("https") ||
    request.url.startsWith("https:");
  const setCookie = [
    `${COOKIE}=${id}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=31536000",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  return { key: `c:${id}`, setCookie };
}

/** @deprecated prefer throttleIdentityFromRequest */
export function clientKeyFromRequest(request: Request): string {
  return throttleIdentityFromRequest(request).key;
}

function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 1;
  return Math.min(5, Math.floor(n));
}

function ipFromTrustedProxy(request: Request, hops: number): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      // Client can prepend spoofed values; the hop at (len - hops) is what the
      // trusted proxy observed (for hops=1: the rightmost entry).
      const idx = Math.max(0, parts.length - hops);
      const ip = sanitize(parts[idx]!);
      if (ip !== "unknown") return ip;
    }
  }
  // X-Real-IP is typically set/overwritten by the proxy when hops are trusted.
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    const ip = sanitize(realIp);
    if (ip !== "unknown") return ip;
  }
  return null;
}

function sanitize(value: string): string {
  return value.replace(/[^\w.:%-]/g, "").slice(0, 64) || "unknown";
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=") || null;
  }
  return null;
}

export function withThrottleCookie(
  headers: HeadersInit | undefined,
  setCookie: string | undefined,
): HeadersInit | undefined {
  if (!setCookie) return headers;
  const h = new Headers(headers);
  h.append("Set-Cookie", setCookie);
  return h;
}
