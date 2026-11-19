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
  return Response.json({
    region: process.env.VERCEL_REGION ?? null,
    dbQueryMs: times,
  });
}
