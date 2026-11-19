"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { GAME_TYPES, gameTypeLabel, isOfc, maxSeatsFor } from "@/lib/poker/variants";

type Tournament = {
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

const GAMES = GAME_TYPES.filter((g) => !isOfc(g));

function money(v: string | number) {
  return Number(v).toLocaleString();
}

const STATUS: Record<string, string> = {
  scheduled: "Registering",
  running: "Playing",
  finished: "Finished",
  cancelled: "Cancelled",
};

/** Admin: create sit & gos / Spin & Gold, start them, cancel them. */
export function TournamentsPanel() {
  const [list, setList] = useState<Tournament[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kind: "mtt" as "mtt" | "spin",
    title: "",
    gameType: "NLH",
    buyIn: "1000",
    fee: "100",
    startingStack: "10000",
    maxPlayers: "9",
    blindMinutes: "10",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/tournaments", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setList(json.tournaments ?? []);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const seatCap = Math.min(9, maxSeatsFor(form.gameType as (typeof GAMES)[number]));

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/admin/tournaments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: form.kind,
        title: form.title,
        gameType: form.gameType,
        buyIn: Number(form.buyIn),
        fee: Number(form.fee),
        startingStack: Number(form.startingStack),
        maxPlayers: form.kind === "spin" ? 3 : Number(form.maxPlayers),
        blindMinutes: Number(form.blindMinutes),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not create the tournament");
      return;
    }
    setForm((s) => ({ ...s, title: "" }));
    await load();
  }

  async function act(t: Tournament, what: "start" | "cancel") {
    if (what === "cancel" && !window.confirm(`Cancel "${t.title}"? Everyone registered gets their chips back.`)) {
      return;
    }
    setError("");
    setBusy(true);
    const res = await fetch(
      what === "start" ? `/api/admin/tournaments/${t.id}/start` : `/api/admin/tournaments/${t.id}`,
      { method: what === "start" ? "POST" : "DELETE" },
    );
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(json.error || "Something went wrong");
    await load();
  }

  const field = (key: keyof typeof form, label: string, type = "number") => (
    <div>
      <label className="label">{label}</label>
      <input
        className="field"
        type={type}
        value={form[key]}
        onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
      />
    </div>
  );

  const shown = list.filter((t) => t.status !== "cancelled").slice(0, 20);

  return (
    <section className="grid gap-4">
      <form onSubmit={create} className="panel grid gap-3 p-4">
        <h2 className="brand text-xl">Create tournament</h2>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["mtt", "Sit & Go"],
              ["spin", "Spin & Gold"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`btn !py-2 !text-sm ${form.kind === k ? "btn-gold" : "btn-ghost"}`}
              onClick={() => setForm((s) => ({ ...s, kind: k }))}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">
          {form.kind === "spin"
            ? "3 players, fast blinds. Starts by itself when the 3rd player registers; the prize is the buy-in × a random multiplier."
            : "One table, up to 9 players (PLO5 7, PLO6 6). You press Start when players have registered (at least 2)."}
        </p>
        {field("title", "Name (optional)", "text")}
        <div>
          <label className="label">Game</label>
          <select
            className="field"
            value={form.gameType}
            onChange={(e) => setForm((s) => ({ ...s, gameType: e.target.value }))}
          >
            {GAMES.map((g) => (
              <option key={g} value={g}>
                {gameTypeLabel(g)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("buyIn", "Buy-in")}
          {field("fee", "Fee (to the club)")}
          {field("startingStack", form.kind === "spin" ? "Starting stack (max 500)" : "Starting stack")}
          {form.kind === "spin" ? null : field("maxPlayers", `Max players (2–${seatCap})`)}
          {form.kind === "spin" ? null : field("blindMinutes", "Minutes per blind level")}
        </div>
        {error ? <p className="text-sm text-[#ffb4b6]">{error}</p> : null}
        <button className="btn btn-gold" type="submit" disabled={busy}>
          Create
        </button>
      </form>

      <div className="grid gap-3">
        <h2 className="brand text-xl">Tournaments</h2>
        {shown.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No tournaments yet.</p>
        ) : (
          shown.map((t) => {
            const entries = Number(t.entries ?? 0);
            const spin = t.kind === "spin";
            return (
              <article key={t.id} className="panel p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{t.title}</h3>
                  <span className="chip">{STATUS[t.status] ?? t.status}</span>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  {spin ? "Spin & Gold" : "Sit & Go"} · {gameTypeLabel((t.game_type || "NLH") as (typeof GAMES)[number])}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Players {entries}/{t.max_players} · Buy-in {money(t.buy_in)} + {money(t.fee)} · Stack{" "}
                  {money(t.starting_stack)}
                  {t.status !== "scheduled" && Number(t.prize_pool ?? 0) > 0
                    ? ` · Prize ${money(t.prize_pool!)}`
                    : ""}
                  {t.spin_multiplier ? ` · ×${t.spin_multiplier}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.status === "scheduled" && !spin ? (
                    <button
                      className="btn btn-gold !py-2 !text-sm"
                      disabled={busy || entries < 2}
                      onClick={() => void act(t, "start")}
                    >
                      {entries < 2 ? "Start (needs 2 players)" : "Start now"}
                    </button>
                  ) : null}
                  {t.status === "scheduled" ? (
                    <button
                      className="btn btn-ghost !py-2 !text-sm"
                      disabled={busy}
                      onClick={() => void act(t, "cancel")}
                    >
                      Cancel &amp; refund
                    </button>
                  ) : null}
                  {t.status === "running" && t.table_id ? (
                    <Link href={`/table/${t.table_id}`} className="btn btn-ghost !py-2 !text-sm">
                      Watch table
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
