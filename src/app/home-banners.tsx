"use client";

import { useEffect, useState } from "react";

/**
 * Home page reward tiles (6-second looping videos). Upload the files to
 * `public/banners/` on GitHub with these exact names and they appear
 * automatically; any that are missing stay hidden.
 */
const BANNERS = [
  { src: "/banners/bad-beat-jackpot.mp4", alt: "Bad Beat Jackpot" },
  { src: "/banners/high-hand.mp4", alt: "High Hand" },
  { src: "/banners/hand-of-the-day.mp4", alt: "Hand of the Day" },
];

export function HomeBanners() {
  const [available, setAvailable] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      BANNERS.map((b) =>
        fetch(b.src, { method: "HEAD" })
          .then((r) => (r.ok ? b.src : null))
          .catch(() => null),
      ),
    ).then((found) => {
      if (!cancelled) setAvailable(found.filter((s): s is string => Boolean(s)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = BANNERS.filter((b) => available.includes(b.src));
  if (!shown.length) return null;

  return (
    <section
      className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
      style={{ scrollbarWidth: "none" }}
      aria-label="Club rewards"
    >
      {shown.map((b) => (
        <video
          key={b.src}
          src={b.src}
          aria-label={b.alt}
          autoPlay
          loop
          muted
          playsInline
          className="aspect-square w-[78%] shrink-0 snap-center rounded-2xl border border-[var(--line)] object-cover shadow-[0_10px_30px_rgba(0,0,0,.35)]"
        />
      ))}
    </section>
  );
}
