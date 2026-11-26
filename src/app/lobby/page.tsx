"use client";

import Link from "next/link";
import { BrandMark } from "../brand-mark";
import { LobbyWater } from "../lobby-water";
import { LobbyTournaments, type LobbyTournament } from "./lobby-tournaments";
import { useCallback, useEffect, useState } from "react";
import { GAME_TYPES, gameTypeLabel, isGameType } from "@/lib/poker/variants";

type LobbyData = {
  leaving?: number;
  tournaments?: LobbyTournament[];
  myTournamentIds?: string[];
  club: { name: string; invite_code?: string };
  tables: Array<{
    id: string;
    title: string;
    game_type?: string;
    sb: string | number;
    bb: string | number;
    seats: number;
    rake_percent: string | number;
    rake_cap_bb: string | number;
    bbjp_enabled: boolean;
    squid_enabled?: boolean;
    squid_target?: number;
    cucurucho_enabled?: boolean;
    cucurucho_ante_bb?: string | number;
    buyin_min: string | number;
    buyin_max: string | number;
  }>;
  bbjp: {
    balance: string | number;
    enabled: boolean;
    trigger_hand: string;
    cycle_collections?: number;
    minimum_hand?: string;
  };
  me: { id: string; display_name: string; chip_balance: string | number } | null;
  isAdmin?: boolean;
};

function money(v: string | number) {
  return Number(v).toLocaleString();
}

export default function LobbyPage() {
  const [data, setData] = useState<LobbyData | null>(null);
  const [game, setGame] = useState("ALL");
  const load = useCallback(async () => {
    const res = await fetch("/api/lobby", { cache: "no-store" });
    const json = await res.json();
    setData(json);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // a table you just left was mid-hand: your chips come back when it ends
  const leaving = data?.leaving ?? 0;
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => void load(), 3000);
    return () => clearTimeout(t);
  }, [leaving, data, load]);

  // registered in a tournament: keep the list fresh so "Go to your table" appears when it starts
  const waitingForTournament = Boolean(
    data?.tournaments?.some((t) => data.myTournamentIds?.includes(t.id)),
  );
  useEffect(() => {
    if (!waitingForTournament) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [waitingForTournament, load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-lg px-5 py-10 text-[var(--muted)]">
        <LobbyWater />
        Loading club lobby…
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-12 pt-[max(20px,env(safe-area-inset-top))]">
        <LobbyWater />
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <BrandMark />
          <p className="mt-1 text-sm text-[var(--muted)]">{data.club.name}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {data.me || data.isAdmin ? (
            <button
              type="button"
              className="btn btn-ghost !py-2 !text-xs"
              onClick={() => void logout()}
            >
              Log out
            </button>
          ) : null}
        </div>
      </div>

      <div className="bbjp-panel mb-4 flex items-center justify-between px-4 py-3">
        <div>
          <div className="bbjp-label text-xs uppercase tracking-wider">
            Bad Beat Jackpot
          </div>
          <div className="brand bbjp-amount text-2xl">
            {money(data.bbjp.balance)}
          </div>
        </div>
        <div className="bbjp-meta text-right text-xs">
          <div>{data.bbjp.enabled ? "Live" : "Off"}</div>
          <div>
            Min {data.bbjp.minimum_hand || data.bbjp.trigger_hand}
          </div>
          <div>
            Cycle {money(data.bbjp.cycle_collections ?? 0)}
          </div>
        </div>
      </div>

      {data.me ? (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--line)] bg-black/20 px-4 py-3">
          <div>
            <div className="font-semibold">{data.me.display_name}</div>
            <div className="text-sm text-[var(--muted)]">Club chips</div>
          </div>
          <div className="brand text-xl text-[var(--gold)]">
            {money(data.me.chip_balance)}
          </div>
        </div>
      ) : (
        <div className="panel mb-5 grid gap-3 p-4">
          <p className="text-sm text-[var(--muted)]">
            Create an account to take a seat, or log in if you already have one.
          </p>
          <Link href="/signup" className="btn btn-gold">
            Create account
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Log in
          </Link>
        </div>
      )}

      <LobbyTournaments
        tournaments={data.tournaments ?? []}
        mine={data.myTournamentIds ?? []}
        signedIn={Boolean(data.me)}
        onChange={load}
      />

      <section className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="brand shrink-0 text-2xl" id="open-tables-heading">Open tables</h2>
          <div className="flex min-w-0 gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Game types">
            {["ALL", ...GAME_TYPES].map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                id={`game-${g}`}
                aria-selected={game === g}
                aria-controls="open-tables"
                title={isGameType(g) ? gameTypeLabel(g) : "All games"}
                className={`btn shrink-0 !px-3 !py-2 !text-xs ${game === g ? "btn-gold" : "btn-ghost"}`}
                onClick={() => setGame(g)}
              >
                {g === "ALL" ? "All" : g.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3" id="open-tables" role="tabpanel" aria-labelledby={`game-${game}`}>
          {data.tables.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No open tables yet. Check back soon.
            </p>
          ) : (
            data.tables.filter((t) => game === "ALL" || (t.game_type || "NLH") === game).map((t) => (
              <article key={t.id} className="panel p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{t.title}</h3>
                  <span className="chip">{t.seats}-max</span>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  {t.game_type || "NLH"} · Blinds {money(t.sb)}/{money(t.bb)} ·
                  Buy-in {money(t.buyin_min)}–{money(t.buyin_max)}
                </p>
                {t.bbjp_enabled || t.squid_enabled || t.cucurucho_enabled ? (
                  <p className="mt-1 text-sm text-[var(--gold)]">
                    {[
                      t.bbjp_enabled ? "BBJP on" : "",
                      t.squid_enabled ? `Squid to ${t.squid_target || 3}` : "",
                      t.cucurucho_enabled
                        ? `Cucurucho ${t.cucurucho_ante_bb || 5}BB`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                <Link
                  href={data.me ? `/table/${t.id}` : "/login"}
                  className="btn btn-gold mt-3 !py-2 !text-sm"
                >
                  {data.me ? "Join table" : "Log in to join"}
                </Link>
              </article>
            ))
          )}
          {data.tables.length > 0 && !data.tables.some((t) => game === "ALL" || (t.game_type || "NLH") === game) ? (
            <p className="text-sm text-[var(--muted)]">No open {game.replaceAll("_", " ")} tables.</p>
          ) : null}
        </div>
      </section>

    </main>
  );
}
