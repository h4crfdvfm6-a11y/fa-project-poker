"use client";

import { useEffect, useState } from "react";

import { FELTS, FELT_KEY, ROOMS, ROOM_KEY } from "@/lib/felt";
import { sized } from "@/lib/looks";
import "./table-looks.css";

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

/** Pick the room around the table (in the table's ☰ menu). Saved on this phone. */
export function RoomPicker() {
  const [room, setRoom] = useState("casino");

  useEffect(() => {
    try {
      setRoom(localStorage.getItem(ROOM_KEY) || "casino");
    } catch {
      // private mode: stays in the casino
    }
  }, []);

  function choose(id: string) {
    setRoom(id);
    if (id === "casino") document.documentElement.removeAttribute("data-room");
    else document.documentElement.setAttribute("data-room", id);
    try {
      localStorage.setItem(ROOM_KEY, id);
    } catch {
      // not saved, but still used for this visit
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ROOMS.map((r) => (
        <button
          key={r.id}
          type="button"
          aria-label={r.label}
          title={r.label}
          aria-pressed={room === r.id}
          onClick={() => choose(r.id)}
          className="shrink-0 overflow-hidden rounded-md p-0"
          style={{
            width: 32,
            height: 56,
            backgroundColor: "color" in r ? r.color : undefined,
            backgroundImage: "src" in r ? `url("${sized(r.src, 128)}")` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            border: room === r.id ? "2px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
            boxShadow: room === r.id ? "0 0 8px rgba(255, 211, 77, 0.7)" : "none",
          }}
        />
      ))}
    </div>
  );
}
