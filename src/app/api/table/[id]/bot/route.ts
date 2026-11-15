import { assertSameOrigin } from "@/lib/csrf";

/** Club v1 is humans-only — AI seats are disabled. */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  return Response.json(
    { error: "AI seats are disabled — this club is humans only" },
    { status: 403 },
  );
}
