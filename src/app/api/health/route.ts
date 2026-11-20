import { sql } from "@/lib/db";

/**
 * Speed check: how long one tiny database query takes from the server
 * (a table refresh runs dozens of these one after another). No data returned.
 */
export async function GET() {
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await sql("select 1");
    times.push(Math.round(performance.now() - t));
  }
  // Which database copy this build talks to (Neon endpoint id only, no secrets):
  // test builds should show a different id from the live app.
  let dbEndpoint: string | null = null;
  try {
    const host = new URL(process.env.DATABASE_URL ?? "").hostname;
    dbEndpoint = host.split(".")[0]!.replace(/-pooler$/, "") || null;
  } catch {
    // no database configured
  }
  return Response.json({
    region: process.env.VERCEL_REGION ?? null,
    env: process.env.VERCEL_ENV ?? null,
    dbEndpoint,
    dbQueryMs: times,
  });
}
