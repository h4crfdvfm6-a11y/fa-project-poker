/**
 * Stable-ish client identity for rate limits (first X-Forwarded-For hop).
 * Not auth — only partitions throttles so one attacker cannot lock everyone out.
 */
export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return sanitize(first);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return sanitize(realIp);
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return sanitize(cf);
  return "unknown";
}

function sanitize(value: string): string {
  return value.replace(/[^\w.:%-]/g, "").slice(0, 64) || "unknown";
}
