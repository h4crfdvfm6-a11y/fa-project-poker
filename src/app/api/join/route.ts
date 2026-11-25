import { joinByInvite } from "@/lib/club";
import { withThrottleCookie } from "@/lib/client-key";
import { assertSameOrigin } from "@/lib/csrf";
import {
  clearInviteGuessFailures,
  inviteGateState,
  recordInviteGuessFailure,
} from "@/lib/invite-limit";
import {
  adminPinConfigured,
  adminPinOk,
  setAdminSession,
  setPlayerSession,
} from "@/lib/session";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const gate = await inviteGateState(request);
  if (gate.blocked) {
    return Response.json(
      { error: "Too many failed invite attempts — try again later" },
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
    inviteCode?: string;
    displayName?: string;
  };
  if (!body.inviteCode?.trim() || !body.displayName?.trim()) {
    return Response.json(
      { error: "Invite code and name required" },
      {
        status: 400,
        headers: withThrottleCookie(undefined, gate.setCookie),
      },
    );
  }

  // the admin PIN typed in the invite box opens admin (players never know it)
  if (adminPinConfigured() && adminPinOk(body.inviteCode)) {
    await clearInviteGuessFailures(request, gate.identity);
    await setAdminSession();
    return Response.json(
      { admin: true },
      { headers: withThrottleCookie(undefined, gate.setCookie) },
    );
  }

  try {
    const member = await joinByInvite(body.inviteCode, body.displayName);
    await clearInviteGuessFailures(request, gate.identity);
    await setPlayerSession(member.id);
    return Response.json(
      { member },
      { headers: withThrottleCookie(undefined, gate.setCookie) },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.toLowerCase().includes("invalid club invite")) {
      const result = await recordInviteGuessFailure(request, gate.identity);
      if (result.locked) {
        return Response.json(
          { error: "Too many failed invite attempts — try again later" },
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
        { error: message },
        {
          status: 400,
          headers: withThrottleCookie(undefined, result.setCookie ?? gate.setCookie),
        },
      );
    }
    return Response.json(
      { error: message },
      {
        status: 400,
        headers: withThrottleCookie(undefined, gate.setCookie),
      },
    );
  }
}
