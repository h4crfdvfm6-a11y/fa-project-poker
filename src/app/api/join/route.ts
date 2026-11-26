import { withThrottleCookie } from "@/lib/client-key";
import { assertSameOrigin } from "@/lib/csrf";
import {
  clearInviteGuessFailures,
  inviteGateState,
} from "@/lib/invite-limit";
import {
  adminPinConfigured,
  adminPinOk,
  setAdminSession,
} from "@/lib/session";

/** Name-and-invite joining is retired: everyone signs up with an account. */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const gate = await inviteGateState(request);
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

  const body = (await request.json().catch(() => ({}))) as { inviteCode?: string };

  // the admin PIN typed in the invite box still opens admin
  if (adminPinConfigured() && adminPinOk(body.inviteCode ?? "")) {
    await clearInviteGuessFailures(request, gate.identity);
    await setAdminSession();
    return Response.json(
      { admin: true },
      { headers: withThrottleCookie(undefined, gate.setCookie) },
    );
  }

  return Response.json(
    { error: "Create an account to play" },
    { status: 410, headers: withThrottleCookie(undefined, gate.setCookie) },
  );
}
