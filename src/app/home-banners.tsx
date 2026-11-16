"use client";

import { useEffect, useState } from "react";

/**
 * Home page banners. Upload the images to `public/banners/` on GitHub with these
 * exact names and they appear automatically; any that are missing stay hidden.
 */
const BANNERS = [
  { src: "/banners/banner-1.jpg", alt: "Shark Club banner 1" },
  { src: "/banners/banner-2.jpg", alt: "Shark Club banner 2" },
  { src: "/banners/banner-3.jpg", alt: "Shark Club banner 3" },
];

export function HomeBanners() {
  const [ready, setReady] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Only show a banner once its image has actually loaded.
    BANNERS.forEach((b) => {
      const img = new Image();
      img.onload = () => setReady((r) => ({ ...r, [b.src]: true }));
      img.src = b.src;
    });
  }, []);

  const shown = BANNERS.filter((b) => ready[b.src]);
  if (!shown.length) return null;

  return (
    <section className="grid gap-4">
      {shown.map((b) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={b.src}
          src={b.src}
          alt={b.alt}
          className="w-full rounded-2xl border border-[var(--line)] shadow-[0_10px_30px_rgba(0,0,0,.35)]"
        />
      ))}
    </section>
  );
}
