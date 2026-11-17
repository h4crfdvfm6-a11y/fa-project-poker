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

/**
 * The three rewards under the shark. Each is an animated scene built from a
 * cut-out picture (no background, so it sits straight on the water). If a
 * cut-out isn't uploaded yet, that reward falls back to its GIF.
 */
type Kind = "jackpot" | "wheel" | "hand";
const REWARDS: Array<{
  kind: Kind;
  title: [string, string];
  sub: string;
  art: string;
  fallback: string[];
}> = [
  {
    kind: "jackpot",
    title: ["Bad Beat", "Jackpot"],
    sub: "Lose with a monster — win the pot",
    art: "/banners/reward-chest.webp",
    fallback: ["/banners/bad-beat-jackpot.mp4", "/banners/Bad_Beat_Jackpot.gif"],
  },
  {
    kind: "wheel",
    title: ["High", "Hand"],
    sub: "Spin the wheel for live rewards",
    art: "/banners/reward-wheel.webp",
    fallback: ["/banners/high-hand.mp4", "/banners/High_Hand.gif"],
  },
  {
    kind: "hand",
    title: ["Hand of", "the Day"],
    sub: "Play the hand of the day to win prizes",
    art: "/banners/reward-table.webp",
    fallback: ["/banners/hand-of-the-day.mp4", "/banners/Hand_of_the_Day.gif"],
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

type Slide = { kind: Kind; title: [string, string]; sub: string; src: string; scene: boolean };

const SPARKS = [
  [12, 30, 0],
  [86, 22, 0.7],
  [20, 78, 1.3],
  [80, 70, 0.4],
  [50, 8, 1.8],
  [66, 46, 1.1],
  [32, 52, 2.2],
];

function RewardScene({ slide, active }: { slide: Slide; active: boolean }) {
  return (
    <div className={`rw-slide rw-${slide.kind} ${active ? "on" : ""}`} aria-hidden={!active}>
      <div className="rw-title">
        <span>{slide.title[0]}</span> <span>{slide.title[1]}</span>
      </div>
      <div className="rw-art">
        <div className="rw-glow" />
        {slide.kind === "wheel" ? <div className="rw-pointer" /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.src} alt={`${slide.title[0]} ${slide.title[1]}`} />
        {SPARKS.map(([x, y, d], i) => (
          <i
            key={i}
            className="rw-spark"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}
          />
        ))}
      </div>
      <div className="rw-sub">{slide.sub}</div>
    </div>
  );
}

function RewardStage({ slides }: { slides: Slide[] }) {
  const [active, setActive] = useState(0);
  const videos = useRef<Array<HTMLVideoElement | null>>([]);

  // Move to the next reward every few seconds, looping.
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  // Fallback videos restart from the beginning each time they come on screen.
  useEffect(() => {
    const v = videos.current[active];
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    }
  }, [active]);

  return (
    <div className="rw-stage" aria-label="Club rewards">
      {slides.map((s, i) =>
        s.scene ? (
          <RewardScene key={s.kind} slide={s} active={i === active} />
        ) : s.src.endsWith(".mp4") ? (
          <video
            key={s.kind}
            ref={(el) => {
              videos.current[i] = el;
            }}
            src={s.src}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={`rw-fallback ${i === active ? "on" : ""}`}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.kind}
            src={s.src}
            alt={`${s.title[0]} ${s.title[1]}`}
            className={`rw-fallback ${i === active ? "on" : ""}`}
          />
        ),
      )}
    </div>
  );
}

export function HomeScreen() {
  const [picture, setPicture] = useState<string | false | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    let cancelled = false;
    void firstThatExists(HOME_PICTURES).then((src) => {
      if (!cancelled) setPicture(src ?? false);
    });
    Promise.all(
      REWARDS.map(async (r): Promise<Slide | null> => {
        if (await exists(r.art)) {
          return { kind: r.kind, title: r.title, sub: r.sub, src: r.art, scene: true };
        }
        const src = await firstThatExists(r.fallback);
        return src ? { kind: r.kind, title: r.title, sub: r.sub, src, scene: false } : null;
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
      {picture ? (
        <div className="home-picture" style={{ backgroundImage: `url("${picture}")` }} />
      ) : picture === false ? (
        <div className="home-fallback-brand">
          <BrandMark size={48} />
        </div>
      ) : null}

      <div className="home-bottom">
        {slides.length ? <RewardStage slides={slides} /> : null}
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
