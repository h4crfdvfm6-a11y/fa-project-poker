"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  playSound,
  setSoundsMuted,
  soundForAction,
  soundsMuted,
} from "@/lib/sounds";
import { AVATAR_GLYPH, CARD_BACK_STYLES } from "@/lib/cosmetics";
import "./table-skin.css";

type TableView = {
  meMemberId: string | null;
  meSeat: number | null;
  table: {
    id: string;
    title: string;
    sb: number;
    bb: number;
    seats: number;
    buyinMin: number;
    buyinMax: number;
    rakePercent: number;
    rakeCapBb: number;
    bbjpEnabled: boolean;
    format?: string;
    gameType?: string;
    status?: string;
    squidEnabled?: boolean;
    squidTarget?: number;
    cucuruchoEnabled?: boolean;
    cucuruchoAnteBb?: number;
    cucuruchoEveryHands?: number;
  };
  squid?: null | {
    pot: number;
    scores: Record<string, number>;
    target: number;
    lastEvent: string | null;
  };
  tournament: null | {
    id: string;
    title: string;
    status: string;
    blindLevel: number;
    blindMinutes: number;
    prizePool: number;
    winnerMemberId: string | null;
  };
  seats: Array<{
    seat: number;
    memberId: string | null;
    name: string;
    stack: number;
    isBot: boolean;
    empty: boolean;
  }>;
  hand: null | {
    handNo: number;
    street: string;
    mode?: "holdem" | "ofc";
    board: string[];
    button: number;
    toAct: number | null;
    pot: number;
    currentBet: number;
    log: string[];
    draft?: string[];
    unit?: number;
    result: null | {
      winners?: Array<{ seat: number; amount: number; hand?: string }>;
      rake?: number;
      bbjpFee?: number;
      bbjpHit?: unknown;
      rows?: Array<{
        seat?: number;
        memberId: string | null;
        front: string;
        middle: string;
        back: string;
        fouled: boolean;
        fantasyNext?: boolean;
        delta?: number;
      }>;
    };
    cucurucho?: boolean;
    seats: Array<{
      seat: number;
      memberId: string;
      name: string;
      stack: number;
      bet: number;
      folded: boolean;
      allIn: boolean;
      isBot: boolean;
      hole: string[];
      ofc?: { front: string[]; middle: string[]; back: string[] };
      fouled?: boolean;
    }>;
  };
  handStrength?: null | {
    label: string;
    premium: string | null;
    intensity: number;
  };
  cosmetics?: null | { avatar: string; felt: string; cardBack: string };
  actions: Array<{ type: string; label: string; amount?: number }>;
  sizing: null | {
    kind: "bet" | "raise";
    min: number;
    max: number;
    presets: number[];
  };
  phase: string;
  version: number;
  bbjp: {
    balance: number;
    enabled: boolean;
    trigger: string;
    collections?: number;
    minimumHand?: string;
  };
};

/**
 * Image assets for the Shark Club table skin. They are served from the
 * prototype worker until they are copied into /public/table — then set
 * NEXT_PUBLIC_TABLE_ASSET_BASE=/table (or change the default below).
 */
const TABLE_ASSET_BASE = (
  process.env.NEXT_PUBLIC_TABLE_ASSET_BASE ||
  "https://cold-wildflower-f465.cardsharksclublondon.workers.dev"
).replace(/\/$/, "");

const asset = (name: string) => `url("${TABLE_ASSET_BASE}/${name}")`;

const SKIN_VARS = {
  "--cs-bg-portrait": asset("casino-table.jpg"),
  "--cs-bg-landscape": asset("landscape-casino.jpg"),
  "--cs-card-back": asset("card-back.jpg"),
  "--cs-chip-red": asset("chip-red.png"),
} as CSSProperties;

const CHIP_COLORS = ["purple", "black", "green", "blue", "red", "orange"] as const;

/** Seat centres (% of the table box) for a 6-max table, clockwise from the hero at the bottom. */
const SIX_MAX_SLOTS: Array<[number, number]> = [
  [50, 86],
  [11, 70],
  [11, 27],
  [50, 11],
  [89, 27],
  [89, 70],
];

/** Where seat `slot` of `count` sits (slot 0 = bottom centre / you). */
function slotPosition(slot: number, count: number): [number, number] {
  if (count === 6) return SIX_MAX_SLOTS[slot] ?? SIX_MAX_SLOTS[0]!;
  const angle = ((90 + (360 / count) * slot) * Math.PI) / 180;
  return [50 + 40 * Math.cos(angle), 46 + 38 * Math.sin(angle)];
}

/** Bet chips sit part-way between the player and the middle of the felt. */
function betPosition([x, y]: [number, number]): [number, number] {
  return [x + (50 - x) * 0.42, y + (48 - y) * 0.42];
}

/** Turn a pot into up to 5 coloured chip stacks (≤8 chips each). */
function potStacks(pot: number, bb: number) {
  if (!pot || !bb) return [] as Array<{ color: string; count: number }>;
  const units = [100, 25, 5, 1, 0.5, 0.25].map((m) => m * bb);
  let left = pot;
  const stacks: Array<{ color: string; count: number }> = [];
  units.forEach((u, i) => {
    const n = Math.floor(left / u);
    if (n > 0 && stacks.length < 5) {
      stacks.push({ color: CHIP_COLORS[i]!, count: Math.min(8, n) });
      left -= n * u;
    }
  });
  if (!stacks.length) stacks.push({ color: "orange", count: 1 });
  return stacks;
}

const SUITS: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };

function PlayingCard({
  card,
  premium,
  cardBack = "back_navy",
}: {
  card: string;
  premium?: boolean;
  cardBack?: string;
}) {
  if (card === "xx") {
    // The default back uses the Shark Club card art; bought backs keep their cosmetic colour.
    const custom = cardBack !== "back_navy" ? CARD_BACK_STYLES[cardBack] : undefined;
    return <div className="cs-card back" style={custom ? { background: custom } : undefined} />;
  }
  const red = card[1] === "h" || card[1] === "d";
  const rank = card[0] === "T" ? "10" : card[0];
  return (
    <div className={`cs-card ${red ? "red" : ""} ${premium ? "premium" : ""}`}>
      <div className="r">{rank}</div>
      <div className="s">{SUITS[card[1]!] || card[1]}</div>
    </div>
  );
}

function avatarFor(name: string, isBot: boolean) {
  if (isBot) return "🤖";
  const faces = ["😎", "🦊", "🤠", "🧔", "👩", "👩‍🦰", "🦈", "🐯", "🦉"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return faces[h % faces.length]!;
}

export default function TablePage() {
  const params = useParams<{ id: string }>();
  const tableId = params.id;
  const [view, setView] = useState<TableView | null>(null);
  const [error, setError] = useState("");
  const [buyIn, setBuyIn] = useState("");
  const [raiseTo, setRaiseTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojis, setEmojis] = useState<string[]>([
    "😂",
    "😎",
    "🔥",
    "😱",
    "👏",
    "❤️",
    "😭",
    "🤔",
    "🎉",
  ]);
  const [reactions, setReactions] = useState<
    Array<{ id: string; seat: number; emoji: string }>
  >([]);
  const lastPremium = useRef<string | null>(null);
  const lastHandNo = useRef<number | null>(null);
  const lastWinHandNo = useRef<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/table/${tableId}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load table");
      return;
    }
    setView(json);
    if (!buyIn && json.table) setBuyIn(String(json.table.buyinMin));
    if (json.sizing) {
      setRaiseTo((prev) => {
        const n = Number(prev);
        if (!prev || n < json.sizing.min || n > json.sizing.max) {
          return String(json.sizing.min);
        }
        return prev;
      });
    }
  }, [tableId, buyIn]);

  useEffect(() => {
    setMuted(soundsMuted());
    void load();
    const t = setInterval(() => void load(), 1200);
    const r = setInterval(() => {
      void fetch(`/api/table/${tableId}/react`)
        .then((res) => res.json())
        .then((json) => {
          if (json.reactions) setReactions(json.reactions);
          if (json.emojis) setEmojis(json.emojis);
        })
        .catch(() => undefined);
    }, 900);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [load, tableId]);

  useEffect(() => {
    if (!view?.handStrength?.premium) return;
    const key = `${view.hand?.handNo}-${view.handStrength.premium}`;
    if (lastPremium.current === key) return;
    lastPremium.current = key;
    playSound("premium");
  }, [view?.handStrength, view?.hand?.handNo]);

  useEffect(() => {
    const handNo = view?.hand?.handNo ?? null;
    if (handNo != null && lastHandNo.current !== handNo) {
      if (lastHandNo.current != null) playSound("deal");
      lastHandNo.current = handNo;
    }
    if (view?.hand?.result && handNo != null && lastWinHandNo.current !== handNo) {
      lastWinHandNo.current = handNo;
      playSound("win");
    }
  }, [view?.hand?.handNo, view?.hand?.result]);

  const seated = view?.meSeat != null;
  const betweenHands =
    !view?.hand ||
    view.hand.street === "waiting" ||
    view.hand.street === "showdown";
  const canLeave = seated && betweenHands;
  const canSit = !seated && betweenHands;

  async function sit(seat: number) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/table/${tableId}/sit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seat, buyIn: Number(buyIn) }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not sit");
      return;
    }
    setView(json);
  }

  async function leave() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/table/${tableId}/leave`, { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not leave");
      return;
    }
    setView(json);
  }

  async function act(type: string, amount?: number) {
    setBusy(true);
    setError("");
    playSound(soundForAction(type));
    const res = await fetch(`/api/table/${tableId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, amount }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Action failed");
      return;
    }
    setView(json);
  }

  async function ofcAutoSet() {
    if (!view?.hand?.draft?.length || view.meSeat == null) return;
    const draft = view.hand.draft;
    const mine = view.hand.seats.find((s) => s.seat === view.meSeat);
    const frontN = mine?.ofc?.front.length ?? 0;
    const midN = mine?.ofc?.middle.length ?? 0;
    const backN = mine?.ofc?.back.length ?? 0;
    const caps = {
      front: Math.max(0, 3 - frontN),
      middle: Math.max(0, 5 - midN),
      back: Math.max(0, 5 - backN),
    };
    const order: Array<"back" | "middle" | "front"> = [];
    for (let i = 0; i < caps.back; i++) order.push("back");
    for (let i = 0; i < caps.middle; i++) order.push("middle");
    for (let i = 0; i < caps.front; i++) order.push("front");
    if (draft.length === 14) {
      // Fantasyland: set 13, discard weakest (last index after rank sort in bot;
      // here discard the last dealt card as a simple client default).
      const discardIndex = 13;
      const placements = Array.from({ length: 13 }, (_, i) => ({
        cardIndex: i,
        row: (order[i] || "front") as "front" | "middle" | "back",
      }));
      setBusy(true);
      setError("");
      const res = await fetch(`/api/table/${tableId}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "ofc_set", placements, discardIndex }),
      });
      const json = await res.json();
      setBusy(false);
      if (!res.ok) {
        setError(json.error || "OFC set failed");
        return;
      }
      setView(json);
      return;
    }
    if (draft.length === 5) {
      const placements = draft.map((_, i) => ({
        cardIndex: i,
        row: order[i] || "front",
      }));
      setBusy(true);
      setError("");
      const res = await fetch(`/api/table/${tableId}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "ofc_set", placements }),
      });
      const json = await res.json();
      setBusy(false);
      if (!res.ok) {
        setError(json.error || "OFC set failed");
        return;
      }
      setView(json);
      return;
    }
    // Pineapple: keep first two into open rows, discard last.
    const placements = [
      { cardIndex: 0, row: order[0] || "front" },
      { cardIndex: 1, row: order[1] || order[0] || "front" },
    ];
    setBusy(true);
    setError("");
    const res = await fetch(`/api/table/${tableId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "ofc_set",
        placements,
        discardIndex: 2,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "OFC set failed");
      return;
    }
    setView(json);
  }

  async function react(emoji: string) {
    playSound("react");
    const res = await fetch(`/api/table/${tableId}/react`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Reaction failed");
      return;
    }
    setReactions(json.reactions || []);
    if (json.emojis) setEmojis(json.emojis);
  }

  if (!view) {
    return (
      <main className="cs-room" style={SKIN_VARS}>
        <div className="cs-toast">Loading table…</div>
      </main>
    );
  }

  const hand = view.hand;
  const handSeats = hand?.seats ?? [];
  const isTournament = view.table.format === "tournament" || Boolean(view.tournament);
  const tournamentDone = view.tournament?.status === "finished";
  const iWon =
    tournamentDone &&
    view.tournament?.winnerMemberId &&
    view.tournament.winnerMemberId === view.meMemberId;

  const seatCount = Math.max(2, view.seats.length);
  const baseSeat = view.meSeat ?? 0;
  const slotOf = (seatNo: number) => (seatNo - baseSeat + seatCount) % seatCount;
  const posOf = (seatNo: number) => slotPosition(slotOf(seatNo), seatCount);
  const pct = ([x, y]: [number, number]) => ({ left: `${x}%`, top: `${y}%` });

  const me = handSeats.find((s) => s.seat === view.meSeat);
  const meSeatInfo = view.seats.find((s) => s.seat === view.meSeat);
  const betsOnTable = handSeats.reduce((sum, s) => sum + (s.bet || 0), 0);
  const totalPot = (hand?.pot ?? 0) + betsOnTable;
  const myTurn = seated && hand?.toAct === view.meSeat && view.actions.length > 0;
  const occupied = view.seats.filter((s) => !s.empty).length;
  const winners = hand?.result?.winners ?? [];

  const foldAction = view.actions.find((a) => a.type === "fold");
  const passiveAction =
    view.actions.find((a) => a.type === "check") ||
    view.actions.find((a) => a.type === "call");
  const allinAction = view.actions.find((a) => a.type === "allin");
  const sizing = view.sizing;
  const raiseValue = sizing
    ? Math.min(sizing.max, Math.max(sizing.min, Number(raiseTo || sizing.min)))
    : 0;
  const raiseStep = Math.max(1, Math.floor(view.table.bb / 2));
  const toCall = Math.max(0, (hand?.currentBet ?? 0) - (me?.bet ?? 0));
  const potPreset = (frac: number) => {
    if (!sizing) return;
    const target = Math.round((hand?.currentBet ?? 0) + frac * (totalPot + toCall));
    setRaiseTo(String(Math.min(sizing.max, Math.max(sizing.min, target))));
  };
  const nudge = (dir: 1 | -1) => {
    if (!sizing) return;
    setRaiseTo(
      String(Math.min(sizing.max, Math.max(sizing.min, raiseValue + dir * raiseStep * 2))),
    );
  };

  const heroAvatar =
    AVATAR_GLYPH[view.cosmetics?.avatar || ""] &&
    view.cosmetics?.avatar !== "avatar_default"
      ? AVATAR_GLYPH[view.cosmetics!.avatar]
      : "😎";
  const heroPos: [number, number] = [50, 80];
  const toActName =
    hand?.toAct != null ? view.seats.find((s) => s.seat === hand.toAct)?.name : null;

  return (
    <main className="cs-room" style={SKIN_VARS}>
      {/* ---------- HUD ---------- */}
      <div className="cs-hud">
        <div className="cs-hud-group">
          <button
            type="button"
            className="cs-hud-circle"
            aria-label="Menu"
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <button type="button" className="cs-hud-wide" onClick={() => setMenuOpen(true)}>
            👥 {occupied} / {view.seats.length}
          </button>
        </div>
        <div className="cs-hud-group">
          <Link href="/lobby" className="cs-hud-circle grid place-items-center" aria-label="Lobby">
            ⌂
          </Link>
          <button
            type="button"
            className="cs-hud-circle"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setSoundsMuted(next);
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      <div className="cs-break-info">
        {isTournament ? (
          <>
            Level <b>{view.tournament?.blindLevel ?? 1}</b>
            <br />
            Prize {view.tournament?.prizePool?.toLocaleString() ?? 0}
          </>
        ) : view.table.bbjpEnabled ? (
          <>
            BBJP
            <br />
            <b>{view.bbjp.balance.toLocaleString()}</b>
          </>
        ) : null}
      </div>

      {error ? (
        <button type="button" className="cs-toast error" onClick={() => setError("")}>
          {error}
        </button>
      ) : tournamentDone ? (
        <div className="cs-toast">
          {iWon ? "🏆 You won the tournament!" : "Tournament finished"} · Prize{" "}
          {view.tournament?.prizePool?.toLocaleString() ?? 0}
        </div>
      ) : null}

      {/* ---------- table ---------- */}
      <div className="cs-table">
        <div className="cs-pot-zone">
          <div className="cs-pot-box">
            Total Pot <b>{totalPot.toLocaleString()}</b>
          </div>
        </div>

        <div className="cs-board">
          {(hand?.board ?? []).map((c, i) => (
            <PlayingCard key={`${c}-${i}`} card={c} />
          ))}
        </div>

        {hand?.pot ? (
          <>
            <div className="cs-chips">
              {potStacks(hand.pot, view.table.bb).map((st, i) => (
                <div
                  key={i}
                  className="cs-vstack"
                  style={{ "--chip": asset(`chip-${st.color}.png`) } as CSSProperties}
                >
                  {Array.from({ length: st.count }, (_, k) => (
                    <i key={k} style={{ bottom: k * 4 }} />
                  ))}
                </div>
              ))}
            </div>
            <div className="cs-chip-count">{hand.pot.toLocaleString()}</div>
          </>
        ) : null}

        <div className="cs-table-info">
          {view.table.gameType || "NLH"} · Blinds{" "}
          <b>
            {view.table.sb} / {view.table.bb}
          </b>
          <br />
          {isTournament
            ? `Blinds up every ${view.tournament?.blindMinutes ?? "—"}m`
            : `Rake ${view.table.rakePercent}% · cap ${view.table.rakeCapBb}BB`}
          {view.squid ? (
            <>
              <br />
              Squid pot <b>{view.squid.pot.toLocaleString()}</b> · first to {view.squid.target}
            </>
          ) : null}
          {view.table.cucuruchoEnabled ? (
            <>
              <br />
              {hand?.cucurucho ? <b>Cucurucho hand</b> : "Cucurucho"} ·{" "}
              {view.table.cucuruchoAnteBb || 5}BB
            </>
          ) : null}
          {hand?.result?.rake ? (
            <>
              <br />
              Rake {hand.result.rake}
              {hand.result.bbjpFee ? ` · BBJP fee ${hand.result.bbjpFee}` : ""}
            </>
          ) : null}
        </div>

        {/* other players (and empty seats) */}
        {view.seats.map((seat) => {
          if (seated && seat.seat === view.meSeat) return null;
          const pos = posOf(seat.seat);
          const live = handSeats.find((s) => s.seat === seat.seat);
          const active = hand?.toAct === seat.seat;
          const right = pos[0] > 55;

          if (seat.empty) {
            const canTake = !busy && !isTournament && canSit;
            return (
              <div key={seat.seat} className="cs-player" style={pct(pos)}>
                <button
                  type="button"
                  className="cs-empty-seat"
                  disabled={!canTake}
                  onClick={() => sit(seat.seat)}
                >
                  {canTake ? "SIT" : "EMPTY"}
                </button>
              </div>
            );
          }

          return (
            <div
              key={seat.seat}
              className={`cs-player ${active ? "active" : ""} ${live?.folded ? "folded" : ""} ${right ? "right" : ""}`}
              style={pct(pos)}
            >
              <div className="cs-avatar-wrap">
                <div className="cs-avatar">{avatarFor(seat.name, seat.isBot)}</div>
                {live?.hole?.length && !live.folded ? (
                  <div className="cs-hole">
                    {live.hole.map((c, i) => (
                      <PlayingCard key={i} card={c} cardBack={view.cosmetics?.cardBack} />
                    ))}
                  </div>
                ) : null}
                {hand && hand.button === seat.seat ? <div className="cs-dealer">D</div> : null}
              </div>
              <div className="cs-name">
                <span>{seat.name}</span>
              </div>
              <span className="cs-stack">{(live?.stack ?? seat.stack).toLocaleString()}</span>
              {live?.allIn ? (
                <span className="cs-tag">ALL-IN</span>
              ) : seat.memberId && view.squid?.scores?.[seat.memberId] ? (
                <span className="cs-tag">
                  🦑 {view.squid.scores[seat.memberId]}/{view.squid.target}
                </span>
              ) : null}
            </div>
          );
        })}

        {/* bet markers */}
        {handSeats
          .filter((s) => s.bet > 0)
          .map((s) => {
            const at =
              seated && s.seat === view.meSeat
                ? betPosition(heroPos)
                : betPosition(posOf(s.seat));
            return (
              <div key={`bet-${s.seat}`} className="cs-bet" style={pct(at)}>
                <div className="cs-mini-stack">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <span>{s.bet.toLocaleString()}</span>
              </div>
            );
          })}

        {/* you */}
        {seated ? (
          <div className={`cs-hero ${me?.folded ? "folded" : ""}`}>
            <div className="cs-hero-avatar">{heroAvatar}</div>
            {me?.hole?.length ? (
              <div className="cs-hero-cards">
                {me.hole.map((c, i) => (
                  <PlayingCard
                    key={`${c}-${i}`}
                    card={c}
                    premium={Boolean(view.handStrength?.premium)}
                    cardBack={view.cosmetics?.cardBack}
                  />
                ))}
              </div>
            ) : null}
            <div className={`cs-hero-label ${myTurn ? "active" : ""}`}>
              You
              {hand && hand.button === view.meSeat ? " · D" : ""}
              {me?.folded ? " · Folded" : me?.allIn ? " · All-in" : ""}
            </div>
            <div className="cs-hero-stack">
              {(me?.stack ?? meSeatInfo?.stack ?? 0).toLocaleString()}
            </div>
            {view.handStrength ? (
              <div className={`cs-hero-hand ${view.handStrength.premium ? "premium" : ""}`}>
                {view.handStrength.label}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* winners */}
        {winners.map((w) => (
          <div
            key={`win-${hand?.handNo}-${w.seat}`}
            className="cs-winner"
            style={pct(
              seated && w.seat === view.meSeat
                ? [50, 62]
                : betPosition(posOf(w.seat)),
            )}
          >
            WIN +{w.amount.toLocaleString()}
            {w.hand ? <small>{w.hand}</small> : null}
          </div>
        ))}

        {/* reactions */}
        {reactions.map((rx) => (
          <div
            key={rx.id}
            className="cs-reaction"
            style={pct(seated && rx.seat === view.meSeat ? heroPos : posOf(rx.seat))}
          >
            {rx.emoji}
          </div>
        ))}
      </div>

      {/* ---------- OFC ---------- */}
      {hand?.mode === "ofc" && hand.toAct === view.meSeat && (hand.draft?.length ?? 0) > 0 ? (
        <div className="cs-ofc">
          <b>OFC Pineapple — set your cards</b>
          <div className="cs-row">
            {(hand.draft || []).map((c, i) => (
              <PlayingCard key={`${c}-${i}`} card={c} cardBack={view.cosmetics?.cardBack} />
            ))}
          </div>
          <div style={{ opacity: 0.75, marginBottom: 6 }}>
            {hand.draft?.length === 5
              ? "Place all 5 into front (3) / middle (5) / back (5)."
              : "Keep 2, discard 1. Auto-set fills back → middle → front."}
          </div>
          <button
            type="button"
            className="cs-action raise"
            style={{ width: "100%", height: 40 }}
            disabled={busy}
            onClick={() => void ofcAutoSet()}
          >
            AUTO-SET THIS DEAL
          </button>
        </div>
      ) : hand?.mode === "ofc" && hand.result?.rows ? (
        <div className="cs-ofc">
          <b>OFC result</b>
          {hand.result.rows.map((r, i) => (
            <div key={r.seat ?? i} style={{ opacity: 0.8 }}>
              Seat {(r.seat ?? i) + 1}
              {r.fouled ? " · Foul" : ""}
              {r.fantasyNext ? " · Fantasy next" : ""} · F {r.front} · M {r.middle} · B{" "}
              {r.back}
              {r.delta != null ? ` · ${r.delta >= 0 ? "+" : ""}${r.delta}` : ""}
            </div>
          ))}
        </div>
      ) : null}

      {/* ---------- controls ---------- */}
      <div className="cs-controls">
        {!seated ? (
          <>
            {!isTournament && canSit ? (
              <div className="cs-buyin">
                Buy-in
                <input
                  type="number"
                  value={buyIn}
                  min={view.table.buyinMin}
                  max={view.table.buyinMax}
                  onChange={(e) => setBuyIn(e.target.value)}
                />
              </div>
            ) : null}
            <div className="cs-wait">
              {isTournament
                ? tournamentDone
                  ? "Head back to the lobby for the next event."
                  : "Watching this tournament table."
                : canSit
                  ? `Tap SIT on an empty seat (buy-in ${view.table.buyinMin.toLocaleString()}–${view.table.buyinMax.toLocaleString()})`
                  : "Hand in progress — you can sit when it ends."}
            </div>
          </>
        ) : hand?.mode === "ofc" ? (
          <div className="cs-wait">
            {hand.toAct === view.meSeat
              ? "Set your OFC rows above."
              : "Waiting for the other OFC player to set…"}
          </div>
        ) : (
          <>
            {sizing && myTurn ? (
              <>
                <div className="cs-presets">
                  {[
                    ["½ Pot", 0.5],
                    ["¾ Pot", 0.75],
                    ["Pot", 1],
                    ["2x Pot", 2],
                  ].map(([label, frac]) => (
                    <button
                      key={label as string}
                      type="button"
                      className="cs-preset"
                      onClick={() => potPreset(frac as number)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="cs-preset allin"
                    onClick={() => setRaiseTo(String(sizing.max))}
                  >
                    All-In
                  </button>
                </div>
                <div className="cs-raise-box">
                  <button type="button" className="cs-round" onClick={() => nudge(-1)}>
                    −
                  </button>
                  <input
                    type="range"
                    min={sizing.min}
                    max={sizing.max}
                    step={raiseStep}
                    value={raiseValue}
                    onChange={(e) => setRaiseTo(e.target.value)}
                  />
                  <button type="button" className="cs-round" onClick={() => nudge(1)}>
                    +
                  </button>
                  <div className="cs-raise-amount">{raiseValue.toLocaleString()}</div>
                </div>
              </>
            ) : (
              <div className="cs-wait">
                {myTurn
                  ? "Your turn"
                  : hand && hand.street !== "waiting" && hand.street !== "showdown"
                    ? toActName
                      ? `Waiting for ${toActName}…`
                      : "Dealing…"
                    : isTournament
                      ? tournamentDone
                        ? "Head back to the lobby for the next event."
                        : "Waiting for the next tournament hand…"
                      : "Waiting for players to start the next hand…"}
              </div>
            )}
            <div className="cs-actions">
              <button
                type="button"
                className="cs-action fold"
                disabled={busy || !myTurn || !foldAction}
                onClick={() => act("fold")}
              >
                FOLD
              </button>
              <button
                type="button"
                className="cs-action call"
                disabled={busy || !myTurn || !passiveAction}
                onClick={() => passiveAction && act(passiveAction.type, passiveAction.amount)}
              >
                {passiveAction?.type === "call"
                  ? `CALL ${(passiveAction.amount ?? toCall).toLocaleString()}`
                  : "CHECK"}
              </button>
              <button
                type="button"
                className="cs-action raise"
                disabled={busy || !myTurn || !sizing}
                onClick={() => sizing && act(sizing.kind, raiseValue)}
              >
                {sizing?.kind === "bet" ? "BET" : "RAISE TO"}
                {sizing && myTurn ? ` ${raiseValue.toLocaleString()}` : ""}
              </button>
              <button
                type="button"
                className="cs-action allin"
                disabled={busy || !myTurn || !allinAction}
                onClick={() => allinAction && act("allin", allinAction.amount)}
              >
                ALL-IN
              </button>
            </div>
          </>
        )}
      </div>

      {/* ---------- menu sheet ---------- */}
      {menuOpen ? (
        <>
          <div className="cs-sheet-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="cs-sheet">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-extrabold">{view.table.title}</div>
                <div style={{ color: "#9ea8b8" }}>
                  {view.table.gameType || "NLH"} · {view.table.sb}/{view.table.bb}
                  {view.table.bbjpEnabled
                    ? ` · BBJP ${view.bbjp.balance.toLocaleString()} (min ${view.bbjp.minimumHand || view.bbjp.trigger})`
                    : ""}
                </div>
              </div>
              <button type="button" className="cs-sheet-btn" onClick={() => setMenuOpen(false)}>
                ✕
              </button>
            </div>

            {seated ? (
              <>
                <h3>Reactions</h3>
                <div className="cs-sheet-row">
                  {emojis.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="cs-sheet-btn emoji"
                      disabled={busy}
                      onClick={() => {
                        void react(e);
                        setMenuOpen(false);
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <h3>Seat</h3>
            <div className="cs-sheet-row">
              <Link href="/lobby" className="cs-sheet-btn grid place-items-center">
                ← Back to lobby
              </Link>
              {seated && (!isTournament || !tournamentDone) ? (
                <button
                  type="button"
                  className="cs-sheet-btn danger"
                  disabled={busy || !canLeave}
                  onClick={() => {
                    void leave();
                    setMenuOpen(false);
                  }}
                >
                  {isTournament
                    ? canLeave
                      ? "Forfeit tournament"
                      : "Forfeit after hand"
                    : canLeave
                      ? "Leave table"
                      : "Leave after hand"}
                </button>
              ) : null}
            </div>

            <h3>Hand log</h3>
            <div className="cs-log">
              {(hand?.log || ["Waiting for players…"]).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
