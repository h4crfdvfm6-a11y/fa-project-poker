import { getPlayerId } from "@/lib/session";
import {
  collectReward,
  ensureDailyReward,
  listPendingRewards,
} from "@/lib/play-points";

/** Pending rewards for the signed-in player. Creates today's login reward once. */
export async function GET() {
  const memberId = await getPlayerId();
  if (!memberId) return Response.json({ rewards: [] });
  await ensureDailyReward(memberId);
  const rewards = await listPendingRewards(memberId);
  return Response.json({ rewards });
}

/** Collect one pending reward by id. */
export async function POST(req: Request) {
  const memberId = await getPlayerId();
  if (!memberId) {
    return Response.json({ error: "Log in first" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) {
    return Response.json({ error: "Missing reward id" }, { status: 400 });
  }
  try {
    await collectReward(memberId, body.id);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not collect" },
      { status: 400 },
    );
  }
  const rewards = await listPendingRewards(memberId);
  return Response.json({ ok: true, rewards });
}
