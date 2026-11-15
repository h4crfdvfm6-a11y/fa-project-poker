import { joinByInvite } from "@/lib/club";
import { assertSameOrigin } from "@/lib/csrf";
import {
  clearInviteGuessFailures,
  inviteGuessBlocked,
  recordInviteGuessFailure,
} from "@/lib/invite-limit";
import { setPlayerSession } from "@/lib/session";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const blocked = await inviteGuessBlocked(request);
  if (blocked) {
    return Response.json(
      { error: "Too many failed invite attempts — try again later" },
      {
        status: 429,
        headers: { "Retry-After": String(blocked.retryAfterSec) },
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
      { status: 400 },
    );
  }
  try {
    const member = await joinByInvite(body.inviteCode, body.displayName);
    await clearInviteGuessFailures(request);
    await setPlayerSession(member.id);
    return Response.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.toLowerCase().includes("invalid club invite")) {
      const result = await recordInviteGuessFailure(request);
      if (result.locked) {
        return Response.json(
          { error: "Too many failed invite attempts — try again later" },
          {
            status: 429,
            headers: { "Retry-After": String(result.retryAfterSec) },
          },
        );
      }
    }
    return Response.json({ error: message }, { status: 400 });
  }
}
