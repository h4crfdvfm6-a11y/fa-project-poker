import {
  adminLoginGateState,
  clearAdminLoginFailures,
  recordAdminLoginFailure,
  withAdminLoginGate,
} from "@/lib/admin-login-limit";
import { withThrottleCookie } from "@/lib/client-key";
import { assertSameOrigin } from "@/lib/csrf";
import { adminPinConfigured, adminPinOk, setAdminSession } from "@/lib/session";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  if (!adminPinConfigured()) {
    return Response.json(
      { error: "ADMIN_PIN is not configured on the server" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { pin?: string };

  return withAdminLoginGate(async () => {
    const gate = await adminLoginGateState(request);
    if (gate.blocked) {
      return Response.json(
        { error: "Too many failed attempts — try again later" },
        {
          status: 429,
          headers: withThrottleCookie(
            { "Retry-After": String(gate.blocked.retryAfterSec) },
            gate.setCookie,
          ),
        },
      );
    }

    if (!body.pin || !adminPinOk(body.pin)) {
      const result = await recordAdminLoginFailure(request, gate.identity);
      if (result.locked) {
        return Response.json(
          { error: "Too many failed attempts — try again later" },
          {
            status: 429,
            headers: withThrottleCookie(
              { "Retry-After": String(result.retryAfterSec) },
              result.setCookie ?? gate.setCookie,
            ),
          },
        );
      }
      return Response.json(
        { error: "Wrong admin PIN" },
        {
          status: 401,
          headers: withThrottleCookie(undefined, result.setCookie ?? gate.setCookie),
        },
      );
    }

    await clearAdminLoginFailures(request, gate.identity);
    await setAdminSession();
    return Response.json(
      { ok: true },
      { headers: withThrottleCookie(undefined, gate.setCookie) },
    );
  });
}
