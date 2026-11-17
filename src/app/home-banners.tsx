"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./brand-mark";
import "./home.css";

/** Full-screen Shark Club picture (in public/banners/ on GitHub); first one found is used. */
const HOME_PICTURES = [
  "/banners/shark-club-home.webp",
  "/banners/913264387_1634729197943554_7988411377112276360_n.jpg",
];

/** Moving-water version of the picture (shark and title stay still). */
const HOME_VIDEO = "/banners/home-water.mp4";

/**
 * Reward tiles, best first: see-through animated WebP (no background at all,
 * works on every phone), then MP4, then the original GIF.
 */
const BANNERS = [
  {
    alt: "Bad Beat Jackpot",
    files: [
      "/banners/bad-beat-jackpot.webp",
      "/banners/bad-beat-jackpot.mp4",
      "/banners/Bad_Beat_Jackpot.gif",
    ],
  },
  {
    alt: "High Hand",
    files: ["/banners/high-hand.webp", "/banners/high-hand.mp4", "/banners/High_Hand.gif"],
  },
  {
    alt: "Hand of the Day",
    files: [
      "/banners/hand-of-the-day.webp",
      "/banners/hand-of-the-day.mp4",
      "/banners/Hand_of_the_Day.gif",
    ],
  },
];

/** How long each reward stays on screen before the next one. */
const SLIDE_MS = 4000;

async function exists(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

async function firstThatExists(files: string[]) {
  for (const f of files) if (await exists(f)) return f;
  return null;
}

type Slide = { alt: string; src: string };

function RewardSquare({ slides }: { slides: Slide[] }) {
  const [active, setActive] = useState(0);
  const videos = useRef<Array<HTMLVideoElement | null>>([]);

  // Move to the next reward every few seconds, looping.
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  // Videos restart from the beginning each time they come on screen.
  useEffect(() => {
    const v = videos.current[active];
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    }
  }, [active]);

  return (
    <div className="home-square" aria-label="Club rewards">
      {slides.map((s, i) =>
        s.src.endsWith(".mp4") ? (
          <video
            key={s.src}
            ref={(el) => {
              videos.current[i] = el;
            }}
            src={s.src}
            aria-label={s.alt}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={i === active ? "on" : ""}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={s.src}
            alt={s.alt}
            loading="eager"
            className={`${i === active ? "on" : ""} ${s.src.endsWith(".webp") ? "clear" : ""}`}
          />
        ),
      )}
    </div>
  );
}

export function HomeScreen() {
  const [picture, setPicture] = useState<string | false | null>(null);
  const [video, setVideo] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    let cancelled = false;
    void firstThatExists(HOME_PICTURES).then((src) => {
      if (!cancelled) setPicture(src ?? false);
    });
    void exists(HOME_VIDEO).then((ok) => {
      if (!cancelled) setVideo(ok);
    });
    Promise.all(
      BANNERS.map(async (b) => {
        const src = await firstThatExists(b.files);
        return src ? { alt: b.alt, src } : null;
      }),
    ).then((list) => {
      if (!cancelled) setSlides(list.filter((x): x is Slide => Boolean(x)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="home-screen">
      {picture && video ? (
        <video
          className="home-picture"
          src={HOME_VIDEO}
          poster={picture}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      ) : picture ? (
        <div className="home-picture" style={{ backgroundImage: `url("${picture}")` }} />
      ) : picture === false ? (
        <div className="home-fallback-brand">
          <BrandMark size={48} />
        </div>
      ) : null}

      <div className="home-bottom">
        {slides.length ? <RewardSquare slides={slides} /> : null}
        <div className="home-buttons">
          <Link href="/lobby" className="btn btn-gold">
            Enter club lobby
          </Link>
          <Link href="/admin" className="btn btn-ghost">
            Club admin
          </Link>
        </div>
      </div>
    </main>
  );
}
