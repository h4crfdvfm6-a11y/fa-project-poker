"use client";

import { useEffect, useState } from "react";

type PendingReward = {
  id: string;
  kind: string;
  reward_key: string;
  chips: number;
  ticket_tier: string;
  tickets: number;
};

const TIER_NAME: Record<string, string> = {
  copper: "Copper",
  silver: "Silver",
  gold: "Gold",
};

function rewardTitle(r: PendingReward) {
  if (r.kind === "tier_up") return `${TIER_NAME[r.ticket_tier] ?? r.ticket_tier} tier reached`;
  return "Daily login reward";
}

/** Shows rewards waiting to be collected when the player arrives. */
export default function RewardsPopup() {
  const [rewards, setRewards] = useState<PendingReward[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/rewards", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (alive) setRewards(json.rewards || []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function collect(id: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/rewards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not collect");
      return;
    }
    setRewards(json.rewards || []);
  }

  if (!rewards.length) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
    >
      <div className="panel w-full max-w-sm p-5">
        <h2 className="brand mb-3 text-xl text-[var(--gold-strong)]">Rewards waiting</h2>
        <div className="grid gap-3">
          {rewards.map((r) => (
            <div key={r.id} className="rounded border border-[var(--gold)]/40 p-3">
              <div className="font-semibold">{rewardTitle(r)}</div>
              <p className="text-sm text-[var(--muted)]">
                {r.chips > 0 ? `${Number(r.chips).toLocaleString()} chips` : null}
                {r.chips > 0 && r.tickets > 0 ? " and " : null}
                {r.tickets > 0
                  ? `${r.tickets} free ${TIER_NAME[r.ticket_tier] ?? r.ticket_tier} tournament ticket${r.tickets > 1 ? "s" : ""}`
                  : null}
              </p>
              <button
                className="btn btn-gold mt-2 !py-2 !text-sm"
                disabled={busy}
                onClick={() => collect(r.id)}
              >
                Collect
              </button>
            </div>
          ))}
        </div>
        {error ? <p className="mt-3 text-sm text-[#ffb4b6]">{error}</p> : null}
      </div>
    </div>
  );
}
