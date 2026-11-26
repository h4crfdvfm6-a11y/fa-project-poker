import { authenticate, startSession } from "@/lib/accounts";
import { assertSameOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (!body.email?.trim() || !body.password) {
    return Response.json({ error: "Enter your email and password" }, { status: 400 });
  }

  const account = await authenticate(body.email, body.password);
  if (!account) {
    return Response.json({ error: "Email or password is wrong" }, { status: 401 });
  }
  await startSession(account);
  return Response.json({ ok: true, admin: account.is_admin });
}
