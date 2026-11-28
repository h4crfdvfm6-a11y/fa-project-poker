import { cookies } from "next/headers";
import { assertSameOrigin } from "@/lib/csrf";
import { clearAdminSession } from "@/lib/session";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const jar = await cookies();
  jar.delete("fa_player");
  await clearAdminSession();
  return Response.json({ ok: true });
}
