"use client";

import { useEffect, useState } from "react";

import { FELTS, FELT_KEY, ROOM_KEY } from "@/lib/felt";
import { sized } from "@/lib/looks";
import "./table-looks.css";
import "./table-owned-rooms.css";

type OwnedBackground = { id: string; title: string; asset_key: string };

/** the casino room is always there; the others are the backgrounds the player bought in the shop */
const CASINO = { id: "casino", title: "Casino", src: "/banners/casino-table.jpg" };

function applyFelt(id: string) {
  if (id === "classic") document.documentElement.removeAttribute("data-felt");
  else document.documentElement.setAttribute("data-felt", id);
}

/** Pick your table colour (in the table's ☰ menu). Saved on this phone. */
export function FeltPicker() {
  const [felt, setFelt] = useState("classic");

  useEffect(() => {
    try {
      setFelt(localStorage.getItem(FELT_KEY) || "classic");
    } catch {
      // private mode: stays on the classic table
    }
  }, []);

  function choose(id: string) {
    setFelt(id);
    applyFelt(id);
    try {
      localStorage.setItem(FELT_KEY, id);
    } catch {
      // not saved, but still used for this visit
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FELTS.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-label={f.label}
          title={f.label}
          onClick={() => choose(f.id)}
          className="shrink-0 rounded-full"
          style={{
            width: 30,
            height: 30,
            background: `radial-gradient(circle at 40% 35%, ${f.color}, #000 140%)`,
            border: felt === f.id ? "2px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
            boxShadow: felt === f.id ? "0 0 8px rgba(255, 211, 77, 0.7)" : "none",
          }}
        />
      ))}
    </div>
  );
}

/** Show the chosen background around the table. The casino room, or a shop background (its picture path). */
function applyRoom(path: string | null) {
  const root = document.documentElement;
  if (path) {
    root.style.setProperty("--owned-room", `url("${path}")`);
    root.setAttribute("data-room", "owned");
  } else {
    root.style.removeProperty("--owned-room");
    root.removeAttribute("data-room");
  }
}

/** Pick the room around the table (in the table's ☰ menu). Saved on this phone. */
export function RoomPicker() {
  const [room, setRoom] = useState("casino");
  const [owned, setOwned] = useState<OwnedBackground[] | null>(null);

  useEffect(() => {
    let stored = "casino";
    try {
      stored = localStorage.getItem(ROOM_KEY) || "casino";
    } catch {
      // private mode: stays in the casino
    }
    setRoom(stored);
    if (stored.startsWith("/banners/")) applyRoom(stored);

    let alive = true;
    fetch("/api/shop", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { catalog?: Array<OwnedBackground & { kind: string }>; me?: { owned?: string[] } | null }) => {
        if (!alive) return;
        const mine = new Set(json.me?.owned ?? []);
        setOwned(
          (json.catalog ?? []).filter((i) => i.kind === "background" && mine.has(i.id)),
        );
      })
      .catch(() => {
        if (alive) setOwned([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  function choose(id: string) {
    setRoom(id);
    applyRoom(id === "casino" ? null : id);
    try {
      localStorage.setItem(ROOM_KEY, id);
    } catch {
      // not saved, but still used for this visit
    }
  }

  const rooms = [CASINO, ...(owned ?? []).map((o) => ({ id: o.asset_key, title: o.title, src: o.asset_key }))];

  return (
    <div className="flex flex-wrap gap-2">
      {rooms.map((r) => (
        <button
          key={r.id}
          type="button"
          aria-label={r.title}
          title={r.title}
          aria-pressed={room === r.id}
          onClick={() => choose(r.id)}
          className="shrink-0 overflow-hidden rounded-md p-0"
          style={{
            width: 32,
            height: 56,
            backgroundImage: `url("${sized(r.src, 128)}")`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            border: room === r.id ? "2px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
            boxShadow: room === r.id ? "0 0 8px rgba(255, 211, 77, 0.7)" : "none",
          }}
        />
      ))}
      {owned !== null && owned.length === 0 ? (
        <p className="w-full text-sm text-[var(--muted)]">
          Buy more backgrounds in the{" "}
          <a href="/shop" className="text-[var(--gold)] underline">Shop</a>.
        </p>
      ) : null}
    </div>
  );
}
