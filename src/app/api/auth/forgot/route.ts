import { createResetToken, sendEmail } from "@/lib/accounts";
import { assertSameOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim() ?? "";

  // Always answer the same way, so the form can't be used to find accounts.
  if (email) {
    const token = await createResetToken(email);
    if (token) {
      const link = `${new URL(request.url).origin}/reset?token=${token}`;
      await sendEmail(
        email,
        "Reset your FA Poker password",
        `<p>Use this link to choose a new password. It works for one hour.</p><p><a href="${link}">Reset password</a></p>`,
      ).catch(() => undefined);
    }
  }
  return Response.json({ ok: true });
}
