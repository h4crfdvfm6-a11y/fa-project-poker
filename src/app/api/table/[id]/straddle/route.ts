import { assertSameOrigin } from "@/lib/csrf";
import { getPlayerId } from "@/lib/session";
import { setPlayerStraddle } from "@/lib/straddle-settings";

/** Tick / untick Straddle or Mississippi straddle for your seat (cash tables). */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const { id } = await ctx.params;
  const playerId = await getPlayerId();
  if (!playerId) {
    return Response.json({ error: "Not logged in" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    straddle?: unknown;
    mississippi?: unknown;
  };
  try {
    const view = await setPlayerStraddle(id, playerId, {
      straddle: typeof body.straddle === "boolean" ? body.straddle : undefined,
      mississippi: typeof body.mississippi === "boolean" ? body.mississippi : undefined,
    });
    return Response.json(view);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
