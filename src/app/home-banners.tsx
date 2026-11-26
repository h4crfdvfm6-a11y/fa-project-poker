"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./brand-mark";
import "./home.css";

/** Full-screen FA Poker picture: the copper medallion on the login door. */
const HOME_PICTURES = ["/banners/Poker%20medallion%20on%20a%20login%20door.png"];

/** No moving-water video on the FA Poker home screen. */
const HOME_VIDEOS: string[] = [];

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

/** Reward GIFs under the picture — switched off at the user's request. */
const SHOW_REWARDS = false;

/** How long each reward stays on screen before the next one. */
const SLIDE_MS = 4000;

/** Splash buttons: same size and look as the buttons printed on the picture. */
const BIG_BUTTON = {
  display: "flex",
  width: "100%",
  height: 64,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: "0.02em",
  textDecoration: "none",
} as const;

const LOG_IN_STYLE = {
  ...BIG_BUTTON,
  color: "#140a04",
  background:
    "linear-gradient(180deg, #e9ad7f 0%, #c97a44 42%, #a65a2a 58%, #dc9562 100%)",
  border: "1px solid #6b3418",
  boxShadow:
    "inset 0 1px 0 rgba(255, 240, 225, 0.75), inset 0 -2px 0 rgba(80, 36, 12, 0.5), 0 3px 8px rgba(0, 0, 0, 0.55)",
} as const;

const CREATE_STYLE = {
  ...BIG_BUTTON,
  color: "#f1d9a8",
  fontWeight: 700,
  background: "rgba(0, 0, 0, 0.55)",
  border: "2px solid #c9a45c",
  boxShadow: "0 0 14px rgba(201, 164, 92, 0.25)",
} as const;

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

/**
 * iPhone only autoplays a video if it is muted *as an attribute* when it
 * starts (React only sets the property), and Low Power Mode blocks autoplay
 * until the first tap. So: force muted, try to play, and try again on the
 * first touch.
 */
function startOnIphone(v: HTMLVideoElement | null) {
  if (!v) return;
  v.muted = true;
  v.defaultMuted = true;
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  const play = () => void v.play().catch(() => undefined);
  play();
  const onTouch = () => {
    play();
    window.removeEventListener("touchstart", onTouch);
    window.removeEventListener("click", onTouch);
  };
  window.addEventListener("touchstart", onTouch, { passive: true });
  window.addEventListener("click", onTouch);
}

export function HomeScreen() {
  const [picture, setPicture] = useState<string | false | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    let cancelled = false;
    void firstThatExists(HOME_PICTURES).then((src) => {
      if (!cancelled) setPicture(src ?? false);
    });
    if (HOME_VIDEOS.length) {
      void firstThatExists(HOME_VIDEOS).then((src) => {
        if (!cancelled) setVideo(src);
      });
    }
    if (SHOW_REWARDS)
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
          ref={startOnIphone}
          className="home-picture clean"
          src={video}
          poster={picture}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      ) : picture ? (
        <div
          className="home-picture clean"
          style={{ backgroundImage: `url("${picture}")` }}
        />
      ) : picture === false ? (
        <div className="home-fallback-brand">
          <BrandMark size={48} />
        </div>
      ) : null}

      <div className="home-bottom">
        {SHOW_REWARDS && slides.length ? <RewardSquare slides={slides} /> : null}
        <div
          className="home-buttons"
          style={{ display: "grid", gap: 14, width: "100%", padding: "0 6%", boxSizing: "border-box" }}
        >
          <Link href="/login" style={LOG_IN_STYLE}>
            Log in
          </Link>
          <Link href="/signup" style={CREATE_STYLE}>
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
