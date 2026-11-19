"use client";

import Link from "next/link";
import { useState } from "react";
import { gameTypeLabel, type GameType } from "@/lib/poker/variants";

export type LobbyTournament = {
  id: string;
  title: string;
  kind?: string;
  game_type?: string;
  status: string;
  buy_in: string | number;
  fee: string | number;
  starting_stack: number;
  max_players: number;
  blind_minutes: number;
  entries?: string | number;
  table_id?: string | null;
  prize_pool?: string | number;
  spin_multiplier?: string | number | null;
};

function money(v: string | number) {
  return Number(v).toLocaleString();
}

/** Lobby: tournaments open for registration or being played. */
export function LobbyTournaments({
  tournaments,
  mine,
  signedIn,
  onChange,
}: {
  tournaments: LobbyTournament[];
  mine: string[];
  signedIn: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function register(t: LobbyTournament, action: "register" | "unregister") {
    setError("");
    setBusy(t.id);
    const res = await fetch(`/api/tournaments/${t.id}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(json.error || "Something went wrong");
    await onChange();
  }

  if (!tournaments.length) return null;

  return (
    <section className="mb-6">
      <h2 className="brand mb-3 text-2xl">Tournaments</h2>
      {error ? <p className="mb-2 text-sm text-[#ffb4b6]">{error}</p> : null}
      <div className="grid gap-3">
        {tournaments.map((t) => {
          const entries = Number(t.entries ?? 0);
          const spin = t.kind === "spin";
          const isMine = mine.includes(t.id);
          const full = entries >= t.max_players;
          const playing = t.status === "running";
          return (
            <article key={t.id} className="panel p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="font-semibold">{t.title}</h3>
                <span className="chip">{playing ? "Playing" : `${entries}/${t.max_players}`}</span>
              </div>
              <p className="text-sm text-[var(--muted)]">
                {spin ? "Spin & Gold" : "Sit & Go"} · {gameTypeLabel((t.game_type || "NLH") as GameType)}
              </p>
              <p className="text-sm text-[var(--muted)]">
                Buy-in {money(t.buy_in)} + {money(t.fee)} · Stack {money(t.starting_stack)}
                {spin ? " · Prize: buy-in × random multiplier" : ` · Blinds up every ${t.blind_minutes} min`}
              </p>
              {isMine && !playing ? (
                <p className="mt-1 text-sm text-[var(--gold)]">
                  You&apos;re registered.{" "}
                  {spin ? "It starts when 3 players are in." : "It starts when the club starts it."}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {playing && isMine && t.table_id ? (
                  <Link href={`/table/${t.table_id}`} className="btn btn-gold !py-2 !text-sm">
                    Go to your table
                  </Link>
                ) : null}
                {!playing && signedIn && !isMine ? (
                  <button
                    className="btn btn-gold !py-2 !text-sm"
                    disabled={busy === t.id || full}
                    onClick={() => void register(t, "register")}
                  >
                    {full ? "Full" : `Register · ${money(Number(t.buy_in) + Number(t.fee))}`}
                  </button>
                ) : null}
                {!playing && isMine ? (
                  <button
                    className="btn btn-ghost !py-2 !text-sm"
                    disabled={busy === t.id}
                    onClick={() => void register(t, "unregister")}
                  >
                    Unregister (chips back)
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
