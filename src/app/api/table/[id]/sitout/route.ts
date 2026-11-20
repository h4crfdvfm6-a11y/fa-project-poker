import { assertSameOrigin } from "@/lib/csrf";
import { setSitOut } from "@/lib/seat-presence";
import { getPlayerId } from "@/lib/session";

/** Sit out from the next hand ({ out: true }) or come back ({ out: false }). */
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
  const body = (await request.json().catch(() => ({}))) as { out?: unknown };
  try {
    await setSitOut(id, playerId, body.out === true);
    return Response.json({ ok: true, out: body.out === true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
