import { createAccount, startSession } from "@/lib/accounts";
import { assertSameOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    displayName?: string;
  };
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const displayName = body.displayName?.trim() ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (displayName.length < 2 || displayName.length > 24) {
    return Response.json({ error: "Name must be 2 to 24 characters" }, { status: 400 });
  }

  try {
    const account = await createAccount({ email, password, displayName });
    await startSession(account);
    return Response.json({ ok: true, admin: account.is_admin });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign up failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
