import { closeTable, createTable, listTables } from "@/lib/club";
import { deleteTable } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/session";
import { assertSameOrigin } from "@/lib/csrf";
import { setTableStraddle } from "@/lib/straddle-settings";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const tables = (await listTables()).filter((t) => t.status !== "deleted");
  return Response.json({ tables });
}

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    gameType?: string;
    sb?: number;
    bb?: number;
    seats?: number;
    buyinMin?: number;
    buyinMax?: number;
    rakePercent?: number;
    rakeCapBb?: number;
    bbjpEnabled?: boolean;
    isPrivate?: boolean;
    squidEnabled?: boolean;
    squidTarget?: number;
    cucuruchoEnabled?: boolean;
    cucuruchoAnteBb?: number;
    cucuruchoEveryHands?: number;
    straddleEnabled?: boolean;
    mississippiEnabled?: boolean;
  };
  // Free play: public (non-private) tables never take rake, and BBJP is on.
  // Rake only applies to admin-hosted private tables behind the club code.
  const isPrivate = Boolean(body.isPrivate);
  try {
    const table = await createTable({
      title: body.title || "",
      gameType: body.gameType || "NLH",
      sb: Number(body.sb ?? 25),
      bb: Number(body.bb ?? 50),
      seats: Number(body.seats ?? 6),
      buyinMin: Number(body.buyinMin ?? 2000),
      buyinMax: Number(body.buyinMax ?? 10000),
      rakePercent: isPrivate ? Number(body.rakePercent ?? 5) : 0,
      rakeCapBb: isPrivate ? Number(body.rakeCapBb ?? 3) : 0,
      bbjpEnabled: isPrivate ? Boolean(body.bbjpEnabled) : true,
      isPrivate,
      squidEnabled: Boolean(body.squidEnabled),
      squidTarget: Number(body.squidTarget ?? 3),
      cucuruchoEnabled: Boolean(body.cucuruchoEnabled),
      cucuruchoAnteBb: Number(body.cucuruchoAnteBb ?? 5),
      cucuruchoEveryHands: Number(body.cucuruchoEveryHands ?? 1),
    });
    const straddle = await setTableStraddle(table.id, {
      straddle: Boolean(body.straddleEnabled),
      mississippi: Boolean(body.mississippiEnabled),
    });
    return Response.json({ table: { ...table, straddle_enabled: straddle.straddle, mississippi_enabled: straddle.mississippi } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}

/** Switch straddles / Mississippi straddle on or off for an existing cash table. */
export async function PATCH(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    straddleEnabled?: unknown;
    mississippiEnabled?: unknown;
  };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  const flags = await setTableStraddle(body.id, {
    straddle: typeof body.straddleEnabled === "boolean" ? body.straddleEnabled : undefined,
    mississippi:
      typeof body.mississippiEnabled === "boolean" ? body.mississippiEnabled : undefined,
  });
  return Response.json(flags);
}

export async function DELETE(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const tableId = searchParams.get("id");
  if (!tableId) {
    return Response.json({ error: "id required" }, { status: 400 });
  }
  // ?delete=1 removes the table for good; otherwise it is just closed
  if (searchParams.get("delete") === "1") await deleteTable(tableId);
  else await closeTable(tableId);
  return Response.json({ ok: true });
}
