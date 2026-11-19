"use client";

import { useEffect, useState } from "react";

import { FELTS, FELT_KEY } from "@/lib/felt";

function applyFelt(id: string) {
  if (id === "classic") document.documentElement.removeAttribute("data-felt");
  else document.documentElement.setAttribute("data-felt", id);
}

/** Lobby: pick your table colour. */
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
    <section className="panel mb-5 p-4">
      <h2 className="brand mb-1 text-xl">Your table</h2>
      <p className="mb-3 text-sm text-[var(--muted)]">Choose the felt colour you play on.</p>
      <div className="grid grid-cols-6 gap-2">
        {FELTS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-label={f.label}
            title={f.label}
            onClick={() => choose(f.id)}
            className="aspect-square rounded-full"
            style={{
              background: `radial-gradient(circle at 40% 35%, ${f.color}, #000 140%)`,
              border: felt === f.id ? "3px solid #ffd34d" : "2px solid rgba(255,255,255,0.25)",
              boxShadow: felt === f.id ? "0 0 12px rgba(255, 211, 77, 0.7)" : "none",
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-[var(--muted)]">
        {FELTS.find((f) => f.id === felt)?.label}
      </p>
    </section>
  );
}
