/**
 * The real table sounds from the original F.A Poker table (chips, card deal,
 * table knock). They live next to the table photo on the prototype host; this
 * route passes them through from our own address so the phone can load them
 * into Web Audio (which needs same-site files) and cache them.
 */
const SOUND_HOST = (
  process.env.NEXT_PUBLIC_TABLE_ASSET_BASE ||
  "https://cold-wildflower-f465.cardsharksclublondon.workers.dev"
).replace(/\/$/, "");

const ALLOWED = new Set(["poker-chips.mp3", "card-deal.mp3", "check-knock.mp3"]);

export async function GET(_request: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!ALLOWED.has(name)) return new Response("Not found", { status: 404 });
  try {
    const res = await fetch(`${SOUND_HOST}/${name}`, { next: { revalidate: 86400 } });
    if (!res.ok) return new Response("Not found", { status: 404 });
    const body = await res.arrayBuffer();
    return new Response(body, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 502 });
  }
}
