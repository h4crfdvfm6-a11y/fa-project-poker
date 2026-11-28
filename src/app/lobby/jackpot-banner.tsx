"use client";

import { useEffect, useRef, useState } from "react";

const POSTER = "/banners/copper-jackpot-poster.webp";

export function JackpotBanner() {
  const [animate, setAnimate] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAnimate(!preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let inView = true;
    const update = () => {
      if (document.hidden || !inView) video.pause();
      else void video.play().catch(() => { /* Keep the poster if autoplay is blocked. */ });
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(video);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      video.pause();
    };
  }, [animate]);

  return (
    <div
      role="img"
      aria-label="Bad Beat Jack Pot. Huge Rewards."
      className="relative w-full overflow-hidden bg-[#080706] bg-contain bg-center bg-no-repeat"
      style={{ aspectRatio: "1288 / 236", backgroundImage: `url("${POSTER}")` }}
    >
      {animate ? (
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
          aria-hidden="true"
          tabIndex={-1}
        />
      ) : null}
    </div>
  );
}
