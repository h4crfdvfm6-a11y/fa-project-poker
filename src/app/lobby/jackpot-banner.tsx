"use client";

import { useEffect, useRef, useState } from "react";

const POSTER = "/banners/copper-jackpot-poster.webp";
const ANIMATED_FALLBACK = "/banners/copper-jackpot-loop.webp";

export function JackpotBanner() {
  const [fallback, setFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (fallback) return;
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    let inView = true;
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    video.muted = true;
    video.defaultMuted = true;
    const showAnimation = () => {
      if (active && inView && !document.hidden) setFallback(true);
    };
    const update = () => {
      clearTimeout(startupTimer);
      if (document.hidden || !inView) video.pause();
      else {
        void video.play().catch(showAnimation);
        startupTimer = setTimeout(() => {
          if (video.paused || video.readyState < 2 || video.currentTime === 0) showAnimation();
        }, 1800);
      }
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer?.observe(video);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      active = false;
      clearTimeout(startupTimer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
      video.pause();
    };
  }, [fallback]);

  return (
    <div
      role="img"
      aria-label="Bad Beat Jack Pot. Huge Rewards."
      data-playback={fallback ? "animation" : "video"}
      className="relative w-full overflow-hidden bg-[#080706] bg-contain bg-center bg-no-repeat"
      style={{ aspectRatio: "1288 / 236", backgroundImage: `url("${fallback ? ANIMATED_FALLBACK : POSTER}")` }}
    >
      {!fallback ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          src="/banners/copper-jackpot-loop.mp4"
          poster={POSTER}
          width={1288}
          height={236}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setFallback(true)}
          aria-hidden="true"
          tabIndex={-1}
        />
      ) : null}
    </div>
  );
}
