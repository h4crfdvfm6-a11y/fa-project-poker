import { addMember, listMembers } from "@/lib/club";
import { removeMember } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/session";
import { assertSameOrigin } from "@/lib/csrf";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  // hide removed players and the test bots
  const members = (await listMembers()).filter(
    (m) => (m as { status?: string }).status !== "removed" && m.role !== "bot",
  );
  return Response.json({ members });
}

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as {
    displayName?: string;
    startingChips?: number;
  };
  if (!body.displayName?.trim()) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }
  try {
    const member = await addMember(
      body.displayName,
      Number(body.startingChips ?? 5000),
    );
    return Response.json({ member });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}

/** Remove a player from the club (takes their chips back). */
export async function DELETE(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const memberId = new URL(request.url).searchParams.get("id");
  if (!memberId) return Response.json({ error: "id required" }, { status: 400 });
  try {
    await removeMember(memberId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
