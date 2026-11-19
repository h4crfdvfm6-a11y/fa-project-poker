"use client";

import { useEffect, useState } from "react";
import { AVATARS, DECKS, DECK_KEY, sized } from "@/lib/looks";

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
    <div className="grid grid-cols-5 gap-2">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          aria-label={a.label}
          title={a.label}
          disabled={disabled}
          onClick={() => onPick(a.id)}
          className="aspect-square overflow-hidden rounded-full p-0"
          style={{
            border: current === a.id ? "3px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
            boxShadow: current === a.id ? "0 0 12px rgba(255, 211, 77, 0.7)" : "none",
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
    <div className="grid grid-cols-4 gap-3">
      {DECKS.map((d) => (
        <button
          key={d.id}
          type="button"
          aria-label={d.label}
          title={d.label}
          onClick={() => choose(d.id)}
          className="overflow-hidden rounded-lg p-0"
          style={{
            aspectRatio: "5 / 7",
            border: deck === d.id ? "3px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
            boxShadow: deck === d.id ? "0 0 12px rgba(255, 211, 77, 0.7)" : "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sized(d.src, 128)} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}
