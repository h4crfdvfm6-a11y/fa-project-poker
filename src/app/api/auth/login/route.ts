import { authenticate, startSession } from "@/lib/accounts";
import { withThrottleCookie } from "@/lib/client-key";
import { assertSameOrigin } from "@/lib/csrf";
import {
  accountLoginGateState,
  clearAccountLoginFailures,
  recordAccountLoginFailure,
} from "@/lib/account-login-limit";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const gate = await accountLoginGateState(request);
  if (gate.blocked) {
    return Response.json(
      { error: "Too many sign-in attempts — try again later" },
      {
        status: 429,
        headers: withThrottleCookie(
          { "Retry-After": String(gate.blocked.retryAfterSec) },
          gate.setCookie,
        ),
      },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (!body.email?.trim() || !body.password) {
    return Response.json(
      { error: "Enter your email and password" },
      { status: 400, headers: withThrottleCookie(undefined, gate.setCookie) },
    );
  }

  const account = await authenticate(body.email, body.password);
  if (!account) {
    const result = await recordAccountLoginFailure(request, gate.identity);
    if (result.locked) {
      return Response.json(
        { error: "Too many sign-in attempts — try again later" },
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
      { error: "Email or password is wrong" },
      {
        status: 401,
        headers: withThrottleCookie(undefined, result.setCookie ?? gate.setCookie),
      },
    );
  }

  await clearAccountLoginFailures(request, gate.identity);
  await startSession(account);
  return Response.json(
    { ok: true, admin: account.is_admin },
    { headers: withThrottleCookie(undefined, gate.setCookie) },
  );
}
