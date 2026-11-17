"use client";

/**
 * Lobby background: the same Shark Club picture as the home page (full
 * quality), darkened so the table list is easy to read. When the moving-water
 * video (home-water.mp4) is in public/banners/ it plays instead, so the water
 * moves here too. Gold sparkles twinkle on top.
 */
import { useState } from "react";
import "./lobby-water.css";

const PICTURE = "/banners/913264387_1634729197943554_7988411377112276360_n.jpg";
const VIDEO = "/banners/home-water.mp4";

const SPARKLES = [
  [8, 14, 0],
  [22, 62, 1.6],
  [88, 20, 0.8],
  [76, 74, 2.4],
  [14, 88, 1.2],
  [92, 48, 3.1],
  [48, 6, 2],
  [60, 94, 0.4],
  [4, 40, 2.8],
  [96, 86, 1.9],
];

export function LobbyWater() {
  const [videoOk, setVideoOk] = useState(true);
  return (
    <div className="lobby-water" aria-hidden>
      {videoOk ? (
        <video
          className="lw-hero"
          src={VIDEO}
          poster={PICTURE}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={() => setVideoOk(false)}
        />
      ) : (
        <div className="lw-hero" style={{ backgroundImage: `url("${PICTURE}")` }} />
      )}
      <div className="lw-shade" />
      {SPARKLES.map(([x, y, d], i) => (
        <i
          key={i}
          className="lw-spark"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}
        />
      ))}
    </div>
  );
}
