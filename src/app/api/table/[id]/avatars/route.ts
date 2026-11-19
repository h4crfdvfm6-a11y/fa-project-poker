import { avatarsAtTable, myAvatar } from "@/lib/avatars";
import { getPlayerId } from "@/lib/session";

/** Avatars the players at this table chose (seat → avatar id), plus yours. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const playerId = await getPlayerId();
  const [bySeat, mine] = await Promise.all([
    avatarsAtTable(id).catch(() => ({})),
    playerId ? myAvatar(playerId).catch(() => null) : Promise.resolve(null),
  ]);
  return Response.json({ bySeat, mine });
}
