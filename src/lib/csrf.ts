/**
 * Reject cross-site state-changing requests that still carry cookies (e.g. form POST).
 * SameSite=Lax helps; Origin/Host matching closes the remaining CSRF gap.
 * Requests that omit both Origin and Referer are rejected (no anonymous bypass).
 */

export function assertSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (origin) {
    try {
      const o = new URL(origin);
      if (!host || o.host !== host) {
        return Response.json({ error: "Invalid request origin" }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Invalid request origin" }, { status: 403 });
    }
    return null;
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  try {
    const ref = new URL(referer);
    if (host && ref.host === host) return null;
  } catch {
    /* fall through */
  }
  return Response.json({ error: "Invalid request origin" }, { status: 403 });
}
