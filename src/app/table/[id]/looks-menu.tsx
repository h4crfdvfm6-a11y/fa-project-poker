"use client";

import { useEffect, useState } from "react";
import { AVATARS, DECKS, DECK_KEY, FACES, FACE_KEY, sized } from "@/lib/looks";

/** Table menu: choose your avatar (everyone sees it). */
export function AvatarPicker({
  current,
  onPick,
  disabled,
}: {
  current: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          aria-label={a.label}
          title={a.label}
          disabled={disabled}
          onClick={() => onPick(a.id)}
          className="shrink-0 overflow-hidden rounded-full p-0"
          style={{
            width: 40,
            height: 40,
            border: current === a.id ? "2px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
            boxShadow: current === a.id ? "0 0 8px rgba(255, 211, 77, 0.7)" : "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sized(a.src, 128)} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

/** Table menu: choose the back of the cards (on this phone). */
export function DeckPicker() {
  const [deck, setDeck] = useState("dark");

  useEffect(() => {
    try {
      setDeck(localStorage.getItem(DECK_KEY) || "dark");
    } catch {
      // private mode: standard dark cards
    }
  }, []);

  function choose(id: string) {
    setDeck(id);
    if (id === "dark") document.documentElement.removeAttribute("data-deck");
    else document.documentElement.setAttribute("data-deck", id);
    try {
      localStorage.setItem(DECK_KEY, id);
    } catch {
      // still used for this visit
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {DECKS.map((d) => (
        <button
          key={d.id}
          type="button"
          aria-label={d.label}
          title={d.label}
          onClick={() => choose(d.id)}
          className="shrink-0 overflow-hidden rounded-md p-0"
          style={{
            width: 32,
            height: 45,
            border: deck === d.id ? "2px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
            boxShadow: deck === d.id ? "0 0 8px rgba(255, 211, 77, 0.7)" : "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sized(d.src, 128)} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

/** Table menu: choose the card fronts (on this phone). Each tile is a little ace of clubs. */
export function FacePicker() {
  const [face, setFace] = useState("classic");

  useEffect(() => {
    try {
      setFace(localStorage.getItem(FACE_KEY) || "classic");
    } catch {
      // private mode: classic cards
    }
  }, []);

  function choose(id: string) {
    setFace(id);
    if (id === "classic") document.documentElement.removeAttribute("data-face");
    else document.documentElement.setAttribute("data-face", id);
    try {
      localStorage.setItem(FACE_KEY, id);
    } catch {
      // still used for this visit
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FACES.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-label={f.label}
          title={f.label}
          onClick={() => choose(f.id)}
          className={`cs-face-tile face-${f.id} shrink-0 overflow-hidden rounded-md p-0`}
          style={{
            width: 32,
            height: 45,
            border: face === f.id ? "2px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
            boxShadow: face === f.id ? "0 0 8px rgba(255, 211, 77, 0.7)" : "none",
          }}
        >
          <span>A</span>
          <span>{f.id === "colour" ? "A" : "♣︎"}</span>
        </button>
      ))}
    </div>
  );
}
