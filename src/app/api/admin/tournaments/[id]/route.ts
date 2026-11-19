import { assertSameOrigin } from "@/lib/csrf";
import { requireAdmin } from "@/lib/session";
import { cancelScheduledTournament } from "@/lib/tournament-cancel";

/** Cancel a tournament before it starts (everyone is refunded). */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  try {
    return Response.json(await cancelScheduledTournament(id));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
