import { createTournament, listTournaments } from "@/lib/club";
import { requireAdmin } from "@/lib/session";
import { assertSameOrigin } from "@/lib/csrf";
import { isGameType, isOfc, maxSeatsFor } from "@/lib/poker/variants";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return Response.json({ tournaments: await listTournaments() });
}

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    buyIn?: number;
    fee?: number;
    startingStack?: number;
    maxPlayers?: number;
    blindMinutes?: number;
    startsAt?: string | null;
    kind?: "mtt" | "spin";
    gameType?: string;
  };
  const gameType = body.gameType && isGameType(body.gameType) ? body.gameType : "NLH";
  if (isOfc(gameType)) {
    return Response.json(
      { error: "Open Face Chinese can't be played as a tournament" },
      { status: 400 },
    );
  }
  // tournaments run on one table for now: at most 9 (fewer for PLO5/PLO6)
  const seatCap = Math.min(9, maxSeatsFor(gameType));
  const maxPlayers = Math.max(2, Math.min(seatCap, Math.floor(Number(body.maxPlayers) || seatCap)));
  try {
    const tournament = await createTournament({
      title: body.title || (body.kind === "spin" ? "Spin & Gold" : "Club Sit & Go"),
      buyIn: Number(body.buyIn ?? 1000),
      fee: Number(body.fee ?? 100),
      startingStack: Number(body.startingStack ?? 10000),
      maxPlayers,
      blindMinutes: Number(body.blindMinutes ?? 10),
      startsAt: body.startsAt ?? null,
      kind: body.kind === "spin" ? "spin" : "mtt",
      gameType,
    });
    return Response.json({ tournament });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
