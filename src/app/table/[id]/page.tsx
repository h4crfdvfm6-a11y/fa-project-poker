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
import { FeltPicker } from "../../felt-choice";
import "./table-skin.css";
import { betPoint, demoView, potStacks, seatPoint } from "./table-layout";

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
      /** your own cards you chose to show after the hand */
      shown?: string[];
      ofc?: { front: string[]; middle: string[]; back: string[] };
      fouled?: boolean;
    }>;
  };
  handStrength?: null | {
    label: string;
    premium: string | null;
    intensity: number;
    /** pair or better made with at least one of your own cards */
    made?: boolean;
    /** the cards that make that hand (yours + board) — they blink gold */
    madeCards?: string[];
  };
  /** ms the player to act has left before the 30 s timer acts for them */
  actionMsLeft?: number | null;
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
  /** test mode: bots fill the table; you can tap SIT even mid-hand */
  botFill?: boolean;
  /** cash tables: straddles the admin allows here, and what you've ticked */
  straddle?: null | {
    straddle: boolean;
    mississippi: boolean;
    mine: { straddle: boolean; mississippi: boolean };
  };
  bbjp: {
    balance: number;
    enabled: boolean;
    trigger: string;
    collections?: number;
    minimumHand?: string;
  };
};

/**
 * Image assets for the table. The casino background still comes from the
 * prototype worker until it is copied into /public/table — then set
 * NEXT_PUBLIC_TABLE_ASSET_BASE=/table (or change the default below).
 */
const TABLE_ASSET_BASE = (
  process.env.NEXT_PUBLIC_TABLE_ASSET_BASE ||
  "https://cold-wildflower-f465.cardsharksclublondon.workers.dev"
).replace(/\/$/, "");

const asset = (name: string) => `url("${TABLE_ASSET_BASE}/${name}")`;

const SKIN_VARS = {
  "--cs-bg-landscape": asset("landscape-casino.jpg"),
  "--cs-card-logo": 'url("/brand/logo.jpg")',
} as CSSProperties;

/** gold edge for a ticked menu option */
const TICKED: CSSProperties = { borderColor: "#ffd34d", color: "#ffd34d", fontWeight: 800 };

const SUITS: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };

function PlayingCard({
  card,
  premium,
  blink,
  cardBack = "back_navy",
}: {
  card: string;
  premium?: boolean;
  /** gold blink: premium starting hand, or part of a made hand */
  blink?: boolean;
  cardBack?: string;
}) {
  if (card === "xx") {
    // Default back = Shark Club logo; bought card backs keep their cosmetic colour.
    const custom = cardBack !== "back_navy" ? CARD_BACK_STYLES[cardBack] : undefined;
    return <div className="cs-card back" style={custom ? { background: custom } : undefined} />;
  }
  const red = card[1] === "h" || card[1] === "d";
  const rank = card[0] === "T" ? "10" : card[0];
  return (
    <div
      className={`cs-card ${red ? "red" : ""} ${premium ? "premium" : ""} ${blink ? "blink" : ""}`}
    >
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
  const isDemo = tableId === "demo";
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
  const prevView = useRef<TableView | null>(null);
  const clockKey = useRef<string>("");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (isDemo) {
      const q = new URLSearchParams(window.location.search);
      const n = Number(q.get("players")) || 6;
      setView(demoView(n, Number(q.get("cards")) || 2) as unknown as TableView);
      setRaiseTo((prev) => prev || "100");
      return;
    }
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
  }, [tableId, buyIn, isDemo]);

  useEffect(() => {
    setMuted(soundsMuted());
    void load();
    if (isDemo) return;
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
  }, [load, tableId, isDemo]);

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

  // Sounds for everyone's moves (like the original table): chips for calls,
  // bets and raises, a knock for a check, a card flick for a fold or new card.
  useEffect(() => {
    const prev = prevView.current;
    prevView.current = view;
    const a = prev?.hand;
    const b = view?.hand;
    if (!a || !b || a.handNo !== b.handNo || b.mode === "ofc") return;
    if (b.board.length > a.board.length) {
      playSound("turn");
      if (b.pot > a.pot) setTimeout(() => playSound("collect"), 120);
      return;
    }
    let played = false;
    for (const s of b.seats) {
      if (s.seat === view?.meSeat) continue; // your own move already made its sound
      const before = a.seats.find((x) => x.seat === s.seat);
      if (!before) continue;
      if (s.folded && !before.folded) {
        playSound("fold");
        played = true;
      } else if (s.bet > before.bet) {
        playSound(s.allIn ? "allin" : s.bet > a.currentBet ? "raise" : "call");
        played = true;
      }
    }
    // the player to act passed without betting or folding: a check
    if (!played && a.toAct != null && a.toAct !== b.toAct && a.toAct !== view?.meSeat) {
      const was = b.seats.find((x) => x.seat === a.toAct);
      const before = a.seats.find((x) => x.seat === a.toAct);
      if (was && before && !was.folded && was.bet === before.bet) playSound("check");
    }
  }, [view]);

  // 30-second turn clock (ring around the name box of the player to act)
  useEffect(() => {
    const h = view?.hand;
    const live =
      h && h.toAct != null && h.street !== "showdown" && h.street !== "waiting" && !h.result;
    if (!h || !live) {
      clockKey.current = "";
      setDeadline(null);
      return;
    }
    const key = `${h.handNo}:${h.street}:${h.toAct}:${h.currentBet}`;
    if (key !== clockKey.current) {
      clockKey.current = key;
      setDeadline(Date.now() + (view?.actionMsLeft ?? 30_000));
    } else if (view?.actionMsLeft != null) {
      setDeadline(Date.now() + view.actionMsLeft);
    }
  }, [view]);

  useEffect(() => {
    if (deadline == null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [deadline]);

  const seated = view?.meSeat != null;
  const betweenHands =
    !view?.hand ||
    view.hand.street === "waiting" ||
    view.hand.street === "showdown";
  const canLeave = seated && betweenHands;
  const canSit = !seated && (betweenHands || Boolean(view?.botFill));

  async function sit(seat: number) {
    if (isDemo) {
      setError("Demo table — actions are switched off.");
      return;
    }
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
    if (isDemo) {
      setError("Demo table — actions are switched off.");
      return;
    }
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
    if (isDemo) {
      setError("Demo table — actions are switched off.");
      return;
    }
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

  /** choose which of your cards everyone sees after the hand */
  async function showCards(cards: string[]) {
    if (isDemo) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/table/${tableId}/show`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cards }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not show cards");
      return;
    }
    await load();
  }

  /** tick / untick Straddle or Mississippi (applies from the next hand) */
  async function setStraddleTick(flags: { straddle?: boolean; mississippi?: boolean }) {
    if (isDemo) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/table/${tableId}/straddle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(flags),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not change straddle");
      return;
    }
    await load();
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
    if (isDemo) {
      setError("Demo table — actions are switched off.");
      return;
    }
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

  // turn clock: ring around the name box of the player to act
  const clockLeft = deadline != null ? Math.max(0, deadline - now) : null;
  const clockFor = (seatNo: number | null | undefined) =>
    clockLeft != null && seatNo != null && hand?.toAct === seatNo
      ? {
          className: "turn-clock",
          style: { "--turn-progress": Math.min(1, clockLeft / 30_000) } as CSSProperties,
          badge: <span className="turn-seconds">{Math.ceil(clockLeft / 1000)}</span>,
        }
      : { className: "", style: undefined, badge: null };

  // gold blink: premium starting hand, or the cards making a pair or better with the board
  const strength = view.handStrength;
  const madeCards = new Set(strength?.made ? (strength.madeCards ?? []) : []);
  const preflopPremium = Boolean(strength?.premium) && (hand?.board.length ?? 0) < 3;
  const madeLabel =
    strength?.made && (hand?.board.length ?? 0) >= 3 ? strength.label : null;
  const isTournament = view.table.format === "tournament" || Boolean(view.tournament);
  const tournamentDone = view.tournament?.status === "finished";
  const iWon =
    tournamentDone &&
    view.tournament?.winnerMemberId &&
    view.tournament.winnerMemberId === view.meMemberId;

  const seatCount = Math.max(2, view.seats.length);
  const dense = seatCount >= 7;
  const baseSeat = view.meSeat ?? 0;
  const slotOf = (seatNo: number) => (seatNo - baseSeat + seatCount) % seatCount;

  const me = handSeats.find((s) => s.seat === view.meSeat);
  // after your part of the hand is over you can show 1, 2 or all your cards
  const shownSet = new Set(me?.shown ?? []);
  const canShow =
    !isDemo &&
    hand?.mode !== "ofc" &&
    Boolean(me?.hole?.length) &&
    !me!.hole.includes("xx") &&
    (Boolean(me?.folded) || hand?.street === "showdown");
  const canPick =
    !isDemo && hand?.mode !== "ofc" && Boolean(me?.hole?.length) && !me!.hole.includes("xx");
  const toggleShow = (c: string) =>
    void showCards(
      shownSet.has(c) ? [...shownSet].filter((x) => x !== c) : [...shownSet, c],
    );
  const meSeatInfo = view.seats.find((s) => s.seat === view.meSeat);
  const betsOnTable = handSeats.reduce((sum, s) => sum + (s.bet || 0), 0);
  const totalPot = (hand?.pot ?? 0) + betsOnTable;
  const myTurn = seated && hand?.toAct === view.meSeat && view.actions.length > 0;
  const occupied = view.seats.filter((s) => !s.empty).length;
  const winners = hand?.result?.winners ?? [];
  const winnerOf = (seatNo: number) => winners.find((w) => w.seat === seatNo);
  const reactionOf = (seatNo: number) => reactions.find((r) => r.seat === seatNo);

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
  const presetValue = (frac: number) => {
    if (!sizing) return 0;
    const target = Math.round((hand?.currentBet ?? 0) + frac * (totalPot + toCall));
    return Math.min(sizing.max, Math.max(sizing.min, target));
  };
  const canSize = Boolean(sizing && myTurn && !busy);
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
  void heroAvatar;
  const fmt = (n: number) => n.toLocaleString();

  return (
    <main className="cs-room" style={SKIN_VARS}>
      {/* ---------- HUD ---------- */}
      <div className="cs-hud">
        <div className="cs-hud-group">
          <button
            type="button"
            className="cs-hud-btn"
            aria-label="Menu"
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <button type="button" className="cs-hud-btn" onClick={() => setMenuOpen(true)}>
            👥 {occupied} / {view.seats.length}
          </button>
        </div>
        <div className="cs-hud-group">
          <Link href="/lobby" className="cs-hud-btn" aria-label="Lobby">
            ⌂
          </Link>
          <button
            type="button"
            className="cs-hud-btn"
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

      {isTournament || view.table.bbjpEnabled ? (
        <div className="cs-corner-info">
          {isTournament ? (
            <>
              Level <b>{view.tournament?.blindLevel ?? 1}</b>
              <br />
              Prize {fmt(view.tournament?.prizePool ?? 0)}
            </>
          ) : (
            <>
              BBJP
              <br />
              <b>{fmt(view.bbjp.balance)}</b>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <button type="button" className="cs-toast error" onClick={() => setError("")}>
          {error}
        </button>
      ) : tournamentDone ? (
        <div className="cs-toast">
          {iWon ? "🏆 You won the tournament!" : "Tournament finished"} · Prize{" "}
          {fmt(view.tournament?.prizePool ?? 0)}
        </div>
      ) : null}

      {/* ---------- table ---------- */}
      <div className="cs-table">
        <div className="cs-rail">
          <div className="cs-felt" />
        </div>

        {/* centre column: pot, board, chips, info — stacked so nothing overlaps */}
        <div className="cs-center">
          <div className="cs-pot-box">
            TOTAL POT <b>{fmt(totalPot)}</b>
          </div>
          <div className="cs-board">
            {(hand?.board ?? []).map((c, i) => (
              <PlayingCard key={`${c}-${i}`} card={c} blink={madeCards.has(c)} />
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
                      <i key={k} style={{ bottom: `${k * 9}%` }} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="cs-chip-count">{fmt(hand.pot)}</div>
            </>
          ) : null}
          <div className="cs-info">
            Blinds{" "}
            <b>
              {fmt(view.table.sb)} / {fmt(view.table.bb)}
            </b>{" "}
            · {view.table.gameType || "NLH"}
            {isTournament ? (
              <>
                <br />
                Blinds up every <b>{view.tournament?.blindMinutes ?? "—"}m</b>
              </>
            ) : null}
            {view.squid ? (
              <>
                <br />
                Squid pot <b>{fmt(view.squid.pot)}</b> · first to {view.squid.target}
              </>
            ) : null}
            {view.table.cucuruchoEnabled ? (
              <>
                <br />
                {hand?.cucurucho ? <b>Cucurucho hand</b> : "Cucurucho"} ·{" "}
                {view.table.cucuruchoAnteBb || 5}BB
              </>
            ) : null}
          </div>
        </div>

        {/* other players and empty seats, spread evenly around the oval */}
        {view.seats.map((seat) => {
          if (seated && seat.seat === view.meSeat) return null;
          const p = seatPoint(slotOf(seat.seat), seatCount);
          const style = { left: p.left, top: `${p.y}%` };
          const live = handSeats.find((s) => s.seat === seat.seat);
          const win = winnerOf(seat.seat);
          const rx = reactionOf(seat.seat);

          if (seat.empty) {
            const canTake = !busy && !isTournament && canSit;
            return (
              <div key={seat.seat} className={`cs-seat ${dense ? "dense" : ""}`} style={style}>
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
              className={`cs-seat ${p.side} ${dense ? "dense" : ""} ${
                hand?.toAct === seat.seat ? "active" : ""
              } ${live?.folded ? "folded" : ""}`}
              style={style}
            >
              <div className="cs-avatar">
                {avatarFor(seat.name, seat.isBot)}
                {hand && hand.button === seat.seat ? <div className="cs-dealer">D</div> : null}
                {win ? (
                  <div className="cs-winner">
                    WIN +{fmt(win.amount)}
                    {win.hand ? <small>{win.hand}</small> : null}
                  </div>
                ) : null}
                {rx ? <div className="cs-reaction">{rx.emoji}</div> : null}
              </div>
              {live?.hole?.length && (!live.folded || live.hole.some((c) => c !== "xx")) ? (
                // fewer, smaller cards for Omaha (4–6) so they stay on screen;
                // a folded player only shows the cards they chose to show
                <div className={`cs-seat-cards n${Math.min(live.hole.length, 6)}`}>
                  {live.hole
                    .filter((c) => !live.folded || c !== "xx")
                    .map((c, i) => (
                      <PlayingCard key={i} card={c} cardBack={view.cosmetics?.cardBack} />
                    ))}
                </div>
              ) : null}
              <div
                className={`cs-plate ${clockFor(seat.seat).className}`}
                style={clockFor(seat.seat).style}
              >
                {clockFor(seat.seat).badge}
                <div className="n">{seat.name}</div>
                <div className="st">{fmt(live?.stack ?? seat.stack)}</div>
                {live?.allIn ? (
                  <div className="bt allin">ALL-IN</div>
                ) : seat.memberId && view.squid?.scores?.[seat.memberId] ? (
                  <div className="bt">
                    🦑 {view.squid.scores[seat.memberId]}/{view.squid.target}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* bets in front of each player: a chip and the amount (like GG Poker) */}
        {handSeats
          .filter((s) => s.bet > 0)
          .map((s) => {
            const b = betPoint(slotOf(s.seat), seatCount);
            const chip = potStacks(s.bet, view.table.bb)[0]?.color ?? "orange";
            return (
              <div
                key={`bet-${s.seat}`}
                className={`cs-bet ${b.anchor}`}
                style={{ left: b.left, top: `${b.top}%` }}
              >
                <i style={{ "--chip": asset(`chip-${chip}.png`) } as CSSProperties} />
                <span>{fmt(s.bet)}</span>
              </div>
            );
          })}

        {/* you */}
        {seated ? (
          <div
            className={`cs-hero ${me?.folded ? "folded" : ""} ${myTurn ? "active" : ""}`}
          >
            {me?.hole?.length ? (
              <div className={`cs-hero-cards n${Math.min(me.hole.length, 6)}`}>
                {me.hole.map((c, i) => (
                  <div
                    key={`${c}-${i}`}
                    className={`cs-hero-card ${shownSet.has(c) ? "shown" : ""}`}
                    onClick={canPick ? () => toggleShow(c) : undefined}
                  >
                    <PlayingCard
                      card={c}
                      premium={Boolean(view.handStrength?.premium)}
                      blink={!me?.folded && (preflopPremium || madeCards.has(c))}
                      cardBack={view.cosmetics?.cardBack}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            <div
              className={`cs-plate ${clockFor(view.meSeat).className}`}
              style={{ position: "relative", ...clockFor(view.meSeat).style }}
            >
              {clockFor(view.meSeat).badge}
              <div className="n">
                You{hand && hand.button === view.meSeat ? " · D" : ""}
              </div>
              <div className="st">{fmt(me?.stack ?? meSeatInfo?.stack ?? 0)}</div>
              {me?.folded ? (
                <div className="bt allin">FOLDED</div>
              ) : me?.allIn ? (
                <div className="bt allin">ALL-IN</div>
              ) : null}
              {view.meSeat != null && winnerOf(view.meSeat) ? (
                <div className="cs-winner">
                  WIN +{fmt(winnerOf(view.meSeat)!.amount)}
                  {winnerOf(view.meSeat)!.hand ? (
                    <small>{winnerOf(view.meSeat)!.hand}</small>
                  ) : null}
                </div>
              ) : null}
              {view.meSeat != null && reactionOf(view.meSeat) ? (
                <div className="cs-reaction">{reactionOf(view.meSeat)!.emoji}</div>
              ) : null}
            </div>
            {madeLabel && !me?.folded ? <div className="cs-made-hand">{madeLabel}</div> : null}
          </div>
        ) : null}
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
      {!seated ? (
        <div className="cs-controls">
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
                ? `Tap SIT on an empty seat (buy-in ${fmt(view.table.buyinMin)}–${fmt(view.table.buyinMax)})`
                : "Hand in progress — you can sit when it ends."}
          </div>
        </div>
      ) : hand?.mode === "ofc" ? (
        <div className="cs-controls">
          <div className="cs-wait">
            {hand.toAct === view.meSeat
              ? "Set your OFC rows above."
              : "Waiting for the other OFC player to set…"}
          </div>
        </div>
      ) : (
        <div className={`cs-controls ${canSize ? "" : "idle"}`}>
          <div className="cs-presets">
            {(
              [
                ["½ Pot", 0.5],
                ["⅔ Pot", 2 / 3],
                ["Pot", 1],
                ["2x Pot", 2],
              ] as Array<[string, number]>
            ).map(([label, frac]) => (
              <button
                key={label}
                type="button"
                className="cs-preset"
                disabled={!canSize}
                onClick={() => setRaiseTo(String(presetValue(frac)))}
              >
                {label}
                <small>{sizing ? fmt(presetValue(frac)) : "—"}</small>
              </button>
            ))}
            <div className="cs-amount">
              <span>{sizing ? fmt(raiseValue) : "—"}</span>
            </div>
          </div>

          <div className="cs-vslider">
            <button
              type="button"
              className="cs-round"
              disabled={!canSize}
              onClick={() => nudge(1)}
              aria-label="Raise more"
            >
              +
            </button>
            <div className="cs-vtrack" style={{ "--len": "42px" } as CSSProperties}>
              <input
                type="range"
                aria-label="Raise amount"
                disabled={!canSize}
                min={sizing?.min ?? 0}
                max={sizing?.max ?? 0}
                step={raiseStep}
                value={raiseValue}
                onChange={(e) => setRaiseTo(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="cs-round"
              disabled={!canSize}
              onClick={() => nudge(-1)}
              aria-label="Raise less"
            >
              −
            </button>
          </div>

          {canShow ? (
            <div className="cs-show">
              <span>SHOW</span>
              {me!.hole.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`cs-show-card ${shownSet.has(c) ? "on" : ""} ${
                    c[1] === "h" || c[1] === "d" ? "red" : ""
                  }`}
                  disabled={busy}
                  onClick={() => toggleShow(c)}
                >
                  {c[0] === "T" ? "10" : c[0]}
                  {SUITS[c[1]!] || c[1]}
                </button>
              ))}
              <button
                type="button"
                className={`cs-show-all ${shownSet.size === me!.hole.length ? "on" : ""}`}
                disabled={busy}
                onClick={() =>
                  void showCards(shownSet.size === me!.hole.length ? [] : [...me!.hole])
                }
              >
                {me!.hole.length === 2 ? "BOTH" : "ALL"}
              </button>
            </div>
          ) : (
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
                ? `CALL ${fmt(passiveAction.amount ?? toCall)}`
                : "CHECK"}
            </button>
            <button
              type="button"
              className="cs-action raise"
              disabled={busy || !myTurn || !sizing}
              onClick={() => sizing && act(sizing.kind, raiseValue)}
            >
              {sizing?.kind === "bet" ? "BET" : "RAISE TO"}
              {sizing && myTurn ? (
                <>
                  <br />
                  {fmt(raiseValue)}
                </>
              ) : null}
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
          )}
        </div>
      )}

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
                  {hand ? ` · Hand #${hand.handNo}` : ""}
                  {view.table.bbjpEnabled
                    ? ` · BBJP ${fmt(view.bbjp.balance)} (min ${view.bbjp.minimumHand || view.bbjp.trigger})`
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

            {seated && (view.straddle?.straddle || view.straddle?.mississippi) ? (
              <>
                <h3>Straddle (from the next hand)</h3>
                <div className="cs-sheet-row">
                  {view.straddle?.straddle ? (
                    <button
                      type="button"
                      className="cs-sheet-btn"
                      style={view.straddle.mine.straddle ? TICKED : undefined}
                      disabled={busy}
                      onClick={() =>
                        void setStraddleTick({ straddle: !view.straddle!.mine.straddle })
                      }
                    >
                      {view.straddle.mine.straddle ? "☑" : "☐"} Straddle
                    </button>
                  ) : null}
                  {view.straddle?.mississippi ? (
                    <button
                      type="button"
                      className="cs-sheet-btn"
                      style={view.straddle.mine.mississippi ? TICKED : undefined}
                      disabled={busy}
                      onClick={() =>
                        void setStraddleTick({ mississippi: !view.straddle!.mine.mississippi })
                      }
                    >
                      {view.straddle.mine.mississippi ? "☑" : "☐"} Mississippi
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            <h3>Table colour</h3>
            <FeltPicker />

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
