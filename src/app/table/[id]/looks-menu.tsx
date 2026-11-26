"use client";

import { useEffect, useState } from "react";
import { DECKS, DECK_KEY, FACES, FACE_KEY, sized } from "@/lib/looks";

type OwnedAvatar = { id: string; title: string; asset_key: string };

/** Table menu: choose your avatar from the ones you own (everyone sees it). */
export function AvatarPicker({
  current,
  onPick,
  disabled,
}: {
  current: string | null;
  onPick: (path: string) => void;
  disabled?: boolean;
}) {
  const [owned, setOwned] = useState<OwnedAvatar[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/shop", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { catalog?: Array<OwnedAvatar & { kind: string }>; me?: { owned?: string[] } | null }) => {
        if (!alive) return;
        const mine = new Set(json.me?.owned ?? []);
        setOwned(
          (json.catalog ?? []).filter((i) => i.kind === "avatar" && mine.has(i.id)),
        );
      })
      .catch(() => {
        if (alive) setOwned([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (owned === null) {
    return <p className="text-sm text-[var(--muted)]">Loading your avatars…</p>;
  }
  if (owned.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        You don&apos;t own any avatars yet. Buy them in the{" "}
        <a href="/shop" className="text-[var(--gold)] underline">Shop</a>.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {owned.map((a) => (
        <button
          key={a.id}
          type="button"
          aria-label={a.title}
          title={a.title}
          disabled={disabled}
          onClick={() => onPick(a.asset_key)}
          className="shrink-0 overflow-hidden rounded-full p-0"
          style={{
            width: 40,
            height: 40,
            border: current === a.asset_key ? "2px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
            boxShadow: current === a.asset_key ? "0 0 8px rgba(255, 211, 77, 0.7)" : "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sized(a.asset_key, 128)} alt="" className="h-full w-full object-cover" />
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
