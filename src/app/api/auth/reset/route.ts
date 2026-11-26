import { resetPassword } from "@/lib/accounts";
import { assertSameOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  if (!body.token || !body.password || body.password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const ok = await resetPassword(body.token, body.password);
  if (!ok) {
    return Response.json({ error: "This link has expired. Ask for a new one." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
