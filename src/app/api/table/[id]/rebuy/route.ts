import { assertSameOrigin } from "@/lib/csrf";
import { getPlayerId } from "@/lib/session";
import { rebuyTournament } from "@/lib/tournament-rebuy";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const memberId = await getPlayerId();
  if (!memberId) return Response.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  try {
    return Response.json(await rebuyTournament(id, memberId, Number(body.handNo), body.decline === true));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not rebuy" }, { status: 400 });
  }
}
