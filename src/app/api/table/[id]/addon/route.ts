import { assertSameOrigin } from "@/lib/csrf";
import { requestAddOn } from "@/lib/table-addon";
import { getPlayerId } from "@/lib/session";

/** Add chips at the table ({ amount }): added now, or before the next deal. */
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
  const body = (await request.json().catch(() => ({}))) as { amount?: unknown };
  try {
    const result = await requestAddOn(id, playerId, Number(body.amount));
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
