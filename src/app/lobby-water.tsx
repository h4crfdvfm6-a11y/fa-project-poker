"use client";

/**
 * Moving deep-water background (lobby). Plays the moving-water video when it
 * is in public/banners/; otherwise two drifting copies of the home picture's
 * water. Gold sparkles twinkle on top; the middle stays darker for reading.
 */
import { useState } from "react";
import "./lobby-water.css";

const PICTURE = "/banners/913264387_1634729197943554_7988411377112276360_n.jpg";
const VIDEO = "/banners/lobby-water.mp4";

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
      <div className="lw-layer lw-a" style={{ backgroundImage: `url("${PICTURE}")` }} />
      <div className="lw-layer lw-b" style={{ backgroundImage: `url("${PICTURE}")` }} />
      {videoOk ? (
        <video
          className="lw-video"
          src={VIDEO}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={() => setVideoOk(false)}
        />
      ) : null}
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
