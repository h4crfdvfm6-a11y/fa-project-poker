import { assertSameOrigin } from "@/lib/csrf";
import { setShownCards } from "@/lib/hand-shows";
import { getPlayerId } from "@/lib/session";

/** Choose which of your cards to show the table after the hand. */
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
  const body = (await request.json().catch(() => ({}))) as { cards?: unknown; handNo?: unknown };
  const cards = Array.isArray(body.cards)
    ? body.cards.filter((c): c is string => typeof c === "string").slice(0, 7)
    : [];
  try {
    const handNo = typeof body.handNo === "number" ? body.handNo : undefined;
    const shown = await setShownCards(id, playerId, cards, handNo);
    return Response.json({ shown });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
