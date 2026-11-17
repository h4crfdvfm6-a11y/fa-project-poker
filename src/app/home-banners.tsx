"use client";

import { useEffect, useState } from "react";

/**
 * Home page reward tiles. Each one plays the MP4 if it is in public/banners/,
 * otherwise the GIF; any that are missing stay hidden.
 */
const BANNERS = [
  {
    alt: "Bad Beat Jackpot",
    files: ["/banners/bad-beat-jackpot.mp4", "/banners/Bad_Beat_Jackpot.gif"],
  },
  { alt: "High Hand", files: ["/banners/high-hand.mp4", "/banners/High_Hand.gif"] },
  {
    alt: "Hand of the Day",
    files: ["/banners/hand-of-the-day.mp4", "/banners/Hand_of_the_Day.gif"],
  },
];

async function firstThatExists(files: string[]) {
  for (const f of files) {
    try {
      const r = await fetch(f, { method: "HEAD" });
      if (r.ok) return f;
    } catch {
      // try the next one
    }
  }
  return null;
}

export function HomeBanners() {
  const [found, setFound] = useState<Array<{ alt: string; src: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      BANNERS.map(async (b) => {
        const src = await firstThatExists(b.files);
        return src ? { alt: b.alt, src } : null;
      }),
    ).then((list) => {
      if (!cancelled) setFound(list.filter((x): x is { alt: string; src: string } => Boolean(x)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!found.length) return null;

  const tile =
    "aspect-square w-[78%] shrink-0 snap-center rounded-2xl border border-[var(--line)] object-cover shadow-[0_10px_30px_rgba(0,0,0,.35)]";

  return (
    <section
      className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
      style={{ scrollbarWidth: "none" }}
      aria-label="Club rewards"
    >
      {found.map((b) =>
        b.src.endsWith(".mp4") ? (
          <video
            key={b.src}
            src={b.src}
            aria-label={b.alt}
            autoPlay
            loop
            muted
            playsInline
            className={tile}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={b.src} src={b.src} alt={b.alt} className={tile} />
        ),
      )}
    </section>
  );
}
