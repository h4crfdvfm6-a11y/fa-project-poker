import { enforceActionTimeout } from "@/lib/action-timeout";
import { getTableView } from "@/lib/table-play";
import { getPlayerId, isAdmin } from "@/lib/session";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const playerId = await getPlayerId();
    const admin = await isAdmin();
    // a player who walked away is checked/folded after 30 seconds
    await enforceActionTimeout(id).catch(() => undefined);
    return Response.json(
      await getTableView(id, playerId, { advance: admin }),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
