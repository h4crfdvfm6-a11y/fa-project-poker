import { setAvatar } from "@/lib/avatars";
import { assertSameOrigin } from "@/lib/csrf";
import { getPlayerId } from "@/lib/session";

/** Choose your avatar (from the table menu). */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "Join the club first" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { avatar?: string };
  try {
    await setAvatar(playerId, String(body.avatar ?? ""));
    return Response.json({ avatar: body.avatar });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
