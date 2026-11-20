"use client";

import { useEffect, useState } from "react";

import { FELTS, FELT_KEY } from "@/lib/felt";

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
