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
  listenForSoundUnlock,
  unlockSounds,
  setSoundsMuted,
  soundForAction,
  soundsMuted,
} from "@/lib/sounds";
import { AVATAR_GLYPH, CARD_BACK_STYLES } from "@/lib/cosmetics";
import { FeltPicker, RoomPicker } from "../../felt-choice";
import { avatarSrc, defaultAvatar, sized } from "@/lib/looks";
import { AvatarPicker, DeckPicker, FacePicker } from "./looks-menu";
import "./table-skin.css";
import {
  betPoint,
  dealerPoint,
  demoView,
  potStacks,
  seatPoint,
} from "./table-layout";

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
    sittingOut?: boolean;
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
    dealRound?: number;
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
  /** ms the player to act has left (10 s pre-flop / 15 s after, + a Time Bank card) */
  actionMsLeft?: number | null;
  /** the whole time for this decision, so the ring empties evenly */
  actionTotalMs?: number | null;
  /** a free Time Bank card (+10 s) is being used right now */
  timeBankInUse?: boolean;
  /** your free Time Bank cards left */
  timeBank?: number | null;
  /** chips you asked to add, waiting for the next deal */
  addonPending?: number;
  rebuy?: null | {
    enabled: boolean;
    untilLevel: number;
    cost: number;
    chips: number;
    deadline: number | null;
    offered: boolean;
    canRebuy: boolean;
    reason: string;
  };
  rebuyWaiting?: boolean;
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
const TICKED: CSSProperties = {
  borderColor: "#ffd34d",
  color: "#ffd34d",
  fontWeight: 800,
};

const SUITS: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };

const OFC_ROWS = [
  { id: "front", label: "Front", size: 3 },
  { id: "middle", label: "Middle", size: 5 },
  { id: "back", label: "Back", size: 5 },
] as const;
type OfcRow = (typeof OFC_ROWS)[number]["id"];

function OfcBoard({ hand, meSeat, busy, submit }: {
  hand: NonNullable<TableView["hand"]>;
  meSeat: number | null;
  busy: boolean;
  submit: (placements: { cardIndex: number; row: OfcRow }[], discardIndex: number | number[] | null) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [choices, setChoices] = useState<Record<number, OfcRow | "discard">>({});
  const draft = !hand.result && hand.toAct === meSeat && meSeat !== null ? hand.draft ?? [] : [];
  const required = draft.length === 3 ? 2 : draft.length >= 14 ? 13 : draft.length;
  const discardCount = draft.length - required;
  const placements = Object.entries(choices).flatMap(([index, row]) =>
    row === "discard" ? [] : [{ cardIndex: Number(index), row }],
  );
  const discarded = draft.flatMap((_, index) => choices[index] === "discard" ? [index] : []);
  const ready = placements.length === required && discarded.length === discardCount;
  const selectedDiscard = selected !== null && choices[selected] === "discard";

  function assign(choice: OfcRow | "discard") {
    if (selected === null) return;
    setChoices((previous) => {
      const next = { ...previous };
      if (next[selected] === choice) delete next[selected];
      else next[selected] = choice;
      return next;
    });
    setSelected(null);
  }

  return (
    <section className="cs-ofc cs-ofc-board" aria-label="Open-Face Chinese Poker">
      <div className="cs-ofc-tables">
        {[...hand.seats].sort((a, b) => Number(b.seat === meSeat) - Number(a.seat === meSeat)).map((seat) => {
          const own = seat.seat === meSeat;
          return (
            <div key={seat.seat} className={own ? "cs-ofc-own" : "cs-ofc-opponent"}>
              <b>{own ? "Your board" : seat.name}{seat.seat === hand.toAct ? " · Setting" : ""}</b>
              {OFC_ROWS.map(({ id, label, size }) => {
                const cards = seat.ofc?.[id] ?? [];
                const pending = own ? placements.filter((entry) => entry.row === id) : [];
                const occupied = cards.length + pending.length;
                return (
                  <div key={id} className="cs-ofc-row">
                    <span>{label}</span>
                    {cards.map((card, index) => <PlayingCard key={index} card={card} />)}
                    {pending.map(({ cardIndex }) => (
                      <button key={cardIndex} type="button" aria-label={`Move ${draft[cardIndex]}`} aria-pressed={selected === cardIndex} onClick={() => setSelected(cardIndex)} disabled={busy}>
                        <PlayingCard card={draft[cardIndex]!} />
                      </button>
                    ))}
                    {Array.from({ length: size - occupied }, (_, index) => own && draft.length ? (
                      <button key={index} type="button" className="cs-ofc-slot" aria-label={`Place in ${label.toLowerCase()}, slot ${occupied + index + 1}`} disabled={busy || selected === null} onClick={() => assign(id)} />
                    ) : <i key={index} className="cs-ofc-slot" />)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {hand.result?.rows?.map((row, index) => (
        <div key={row.seat ?? index}>
          Seat {(row.seat ?? index) + 1} · {row.fouled ? "Foul" : `${row.front} / ${row.middle} / ${row.back}`}
          {row.fantasyNext ? " · Fantasyland next" : ""}
          {row.delta != null ? ` · ${row.delta >= 0 ? "+" : ""}${row.delta.toLocaleString()}` : ""}
        </div>
      ))}
      {draft.length > 0 && (
        <>
          <p>{discardCount ? `Place ${required} and discard ${discardCount}.` : "Place all five cards."} Tap a card, then an empty slot.</p>
          <div className="cs-row">
            {draft.map((card, index) => (
              <button key={index} type="button" disabled={busy} aria-pressed={selected === index} aria-label={`Select ${card}${choices[index] ? `, ${choices[index]}` : ""}`} onClick={() => setSelected(index)}>
                <PlayingCard card={card} />
                {choices[index] && <small>{choices[index]}</small>}
              </button>
            ))}
          </div>
          <div className="cs-ofc-actions">
            {discardCount > 0 && <button type="button" disabled={busy || selected === null || (discarded.length >= discardCount && !selectedDiscard)} onClick={() => assign("discard")}>{selectedDiscard ? "Undo discard" : "Discard selected"}</button>}
            <button type="button" disabled={busy || !Object.keys(choices).length} onClick={() => { setChoices({}); setSelected(null); }}>Reset</button>
            <button type="button" disabled={busy || !ready} onClick={() => void submit(placements, discarded.length ? discarded : null)}>Confirm</button>
          </div>
        </>
      )}
    </section>
  );
}

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
    const custom =
      cardBack !== "back_navy" ? CARD_BACK_STYLES[cardBack] : undefined;
    return (
      <div
        className="cs-card back"
        style={custom ? { background: custom } : undefined}
      />
    );
  }
  if (card === "j0" || card === "j1") return <div className="cs-card cs-joker" aria-label="Joker">★</div>;
  const suit = card[1]!;
  const red = suit === "h" || suit === "d";
  const rank = card[0] === "T" ? "10" : card[0];
  // GG-style face: rank top-left, small suit under it, big suit bottom-right
  // (.rb = big rank, only shown by the "coloured cards" style). See table-looks.css.
  return (
    <div
      className={`cs-card suit-${suit} ${red ? "red" : ""} ${premium ? "premium" : ""} ${blink ? "blink" : ""}`}
      aria-label={`${rank}${SUITS[suit] || suit}`}
    >
      <div className="r">{rank}</div>
      <div className="ss">
        <SuitIcon suit={suit} />
      </div>
      <div className="s">
        <SuitIcon suit={suit} />
      </div>
      <div className="rb">{rank}</div>
    </div>
  );
}

/** Solid suit shapes drawn in the card's colour (emoji suits look different on every phone). */
function SuitIcon({ suit }: { suit: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {suit === "h" ? (
        <path d="M50 92C22 68 3 50 3 29 3 13 15 3 29 3c10 0 17 6 21 14 4-8 11-14 21-14 14 0 26 10 26 26 0 21-19 39-47 63z" />
      ) : suit === "d" ? (
        <path d="M50 2 89 50 50 98 11 50z" />
      ) : suit === "s" ? (
        <path d="M50 3C63 24 97 40 97 63c0 14-10 23-23 23-9 0-16-4-20-11 1 9 5 16 13 23H33c8-7 12-14 13-23-4 7-11 11-20 11C13 86 3 77 3 63 3 40 37 24 50 3z" />
      ) : (
        <>
          <circle cx="50" cy="27" r="21" />
          <circle cx="27" cy="57" r="21" />
          <circle cx="73" cy="57" r="21" />
          <circle cx="50" cy="52" r="12" />
          <path d="M45 52h10c0 20 4 33 14 45H31c10-12 14-25 14-45z" />
        </>
      )}
    </svg>
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
  const [menuSection, setMenuSection] = useState("seat");
  const [notice, setNotice] = useState("");

  useEffect(() => listenForSoundUnlock(), []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
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
  // avatars the players here chose (seat → id) and yours
  const [avatars, setAvatars] = useState<{
    bySeat: Record<string, string>;
    mine: string | null;
  }>({
    bySeat: {},
    mine: null,
  });
  const [now, setNow] = useState(() => Date.now());
  // pre-action: tick CHECK / FOLD before your turn (hand number it was ticked for)
  const [preCheckFold, setPreCheckFold] = useState<number | null>(null);
  const preFired = useRef("");
  // add chips at the table (menu → Seat)
  const [addAmt, setAddAmt] = useState("");

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

  const loadAvatars = useCallback(async () => {
    if (isDemo) return;
    const res = await fetch(`/api/table/${tableId}/avatars`, {
      cache: "no-store",
    }).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    if (json)
      setAvatars({ bySeat: json.bySeat ?? {}, mine: json.mine ?? null });
  }, [tableId, isDemo]);

  useEffect(() => {
    void loadAvatars();
    if (isDemo) return;
    const t = setInterval(() => void loadAvatars(), 5000);
    return () => clearInterval(t);
  }, [loadAvatars, isDemo]);

  /** choose your avatar: everyone at the table sees it */
  async function pickAvatar(id: string) {
    if (isDemo) {
      setError("Demo table — actions are switched off.");
      return;
    }
    setAvatars((a) => ({ ...a, mine: id }));
    const res = await fetch("/api/me/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar: id }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not change avatar");
    }
    await loadAvatars();
  }

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
    if (
      view?.hand?.result &&
      handNo != null &&
      lastWinHandNo.current !== handNo
    ) {
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
    if (
      !played &&
      a.toAct != null &&
      a.toAct !== b.toAct &&
      a.toAct !== view?.meSeat
    ) {
      const was = b.seats.find((x) => x.seat === a.toAct);
      const before = a.seats.find((x) => x.seat === a.toAct);
      if (was && before && !was.folded && was.bet === before.bet)
        playSound("check");
    }
  }, [view]);

  // 30-second turn clock (ring around the name box of the player to act)
  useEffect(() => {
    const h = view?.hand;
    const live =
      h &&
      h.toAct != null &&
      h.street !== "showdown" &&
      h.street !== "waiting" &&
      !h.result;
    if (!h || !live) {
      clockKey.current = "";
      setDeadline(null);
      return;
    }
    const key = `${h.handNo}:${h.street}:${h.toAct}:${h.currentBet}`;
    if (key !== clockKey.current) {
      clockKey.current = key;
      setDeadline(Date.now() + (view?.actionMsLeft ?? 15_000));
    } else if (view?.actionMsLeft != null) {
      setDeadline(Date.now() + view.actionMsLeft);
    }
  }, [view]);

  useEffect(() => {
    if (deadline == null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [deadline]);

  useEffect(() => {
    if (!view?.rebuy?.offered) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [view?.rebuy?.offered]);

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
      // the hand you're looking at, so a late tap can't land on the next hand
      body: JSON.stringify({ cards, handNo: view?.hand?.handNo }),
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
  async function setStraddleTick(flags: {
    straddle?: boolean;
    mississippi?: boolean;
  }) {
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

  /** sit out from the next hand, or come back */
  async function setSitOut(out: boolean) {
    if (isDemo) {
      setError("Demo table — actions are switched off.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/table/${tableId}/sitout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ out }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not change sit out");
      return;
    }
    await load();
  }

  async function testSound() {
    setMuted(false);
    setSoundsMuted(false);
    if (await unlockSounds()) {
      playSound("bet");
      setNotice("Sound is on.");
    } else {
      setNotice("Tap Test sound again to enable audio.");
    }
  }

  async function rebuy(decline = false) {
    if (isDemo || !view?.hand) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/table/${tableId}/rebuy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handNo: view.hand.handNo, decline }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not rebuy");
      setNotice(
        decline
          ? "Rebuy declined."
          : "Rebuy complete. You keep your seat for the next hand.",
      );
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not rebuy");
    } finally {
      setBusy(false);
    }
  }

  /** add chips to your stack: straight away between hands, otherwise before the next deal */
  async function addChips() {
    if (isDemo) {
      setError("Demo table — actions are switched off.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/table/${tableId}/addon`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: Number(addAmt) }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not add chips");
      return;
    }
    setAddAmt("");
    setNotice(
      json.added
        ? "Chips added to your stack."
        : "Chips will be added before the next hand.",
    );
    await load();
  }

  async function submitOfc(placements: { cardIndex: number; row: OfcRow }[], discardIndex: number | number[] | null) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/table/${tableId}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "ofc_set", placements, discardIndex,
          handNo: view?.hand?.handNo, dealRound: view?.hand?.dealRound,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not set OFC cards");
      setView(json);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not set OFC cards");
    } finally {
      setBusy(false);
    }
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

  // when your turn comes with CHECK / FOLD ticked: check if free, otherwise fold
  useEffect(() => {
    if (preCheckFold == null) return;
    const h = view?.hand;
    if (!h || h.handNo !== preCheckFold) {
      setPreCheckFold(null);
      return;
    }
    const mine = h.seats.find((s) => s.seat === view?.meSeat);
    if (!mine || mine.folded || mine.allIn) {
      setPreCheckFold(null);
      return;
    }
    if (h.toAct !== view?.meSeat || !view?.actions.length || busy) return;
    const key = `${h.handNo}:${h.street}:${h.currentBet}`;
    if (preFired.current === key) return;
    preFired.current = key;
    setPreCheckFold(null);
    void act(view.actions.some((a) => a.type === "check") ? "check" : "fold");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, preCheckFold, busy]);

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
          style: {
            "--turn-progress": Math.min(
              1,
              clockLeft / (view.actionTotalMs || 15_000),
            ),
          } as CSSProperties,
          badge: (
            <span
              className={`turn-seconds ${view.timeBankInUse ? "bank" : ""}`}
            >
              {view.timeBankInUse ? "⏱" : ""}
              {Math.ceil(clockLeft / 1000)}
            </span>
          ),
        }
      : { className: "", style: undefined, badge: null };

  // gold blink: premium starting hand, or the cards making a pair or better with the board
  const strength = view.handStrength;
  const madeCards = new Set(strength?.made ? (strength.madeCards ?? []) : []);
  const preflopPremium =
    Boolean(strength?.premium) && (hand?.board.length ?? 0) < 3;
  const madeLabel =
    strength?.made && (hand?.board.length ?? 0) >= 3 ? strength.label : null;
  const isTournament =
    view.table.format === "tournament" || Boolean(view.tournament);
  const tournamentDone = view.tournament?.status === "finished";
  const iWon =
    tournamentDone &&
    view.tournament?.winnerMemberId &&
    view.tournament.winnerMemberId === view.meMemberId;

  const seatCount = Math.max(2, view.seats.length);
  const dense = seatCount >= 7;
  const baseSeat = view.meSeat ?? 0;
  const slotOf = (seatNo: number) =>
    (seatNo - baseSeat + seatCount) % seatCount;

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
    !isDemo &&
    hand?.mode !== "ofc" &&
    Boolean(me?.hole?.length) &&
    !me!.hole.includes("xx");
  const toggleShow = (c: string) =>
    void showCards(
      shownSet.has(c) ? [...shownSet].filter((x) => x !== c) : [...shownSet, c],
    );
  const meSeatInfo = view.seats.find((s) => s.seat === view.meSeat);
  // sitting out (cash tables): you're dealt in again from the next hand after "I'm back"
  const meSittingOut = Boolean(meSeatInfo?.sittingOut);
  const betsOnTable = handSeats.reduce((sum, s) => sum + (s.bet || 0), 0);
  const totalPot = (hand?.pot ?? 0) + betsOnTable;
  const myTurn =
    seated && hand?.toAct === view.meSeat && view.actions.length > 0;
  // you're in this hand, it isn't your turn yet, and betting is still going on
  const preEligible =
    seated &&
    !isDemo &&
    !myTurn &&
    hand?.mode !== "ofc" &&
    !hand?.result &&
    hand?.street !== "waiting" &&
    hand?.street !== "showdown" &&
    hand?.toAct != null &&
    Boolean(me?.hole?.length) &&
    !me?.folded &&
    !me?.allIn;
  const occupied = view.seats.filter((s) => !s.empty).length;
  // add chips: cash tables, up to the table maximum
  const myStackNow = me?.stack ?? meSeatInfo?.stack ?? 0;
  const addRoom = Math.max(0, Math.floor(view.table.buyinMax - myStackNow));
  const canAddChips = seated && !isTournament && !isDemo;
  const rebuySeconds = Math.max(
    0,
    Math.ceil(((view.rebuy?.deadline ?? 0) - now) / 1000),
  );
  const busted =
    canAddChips && myStackNow <= 0 && !me?.hole?.length && !view.addonPending;
  const winners = hand?.result?.winners ?? [];
  const winnerOf = (seatNo: number) => winners.find((w) => w.seat === seatNo);
  const reactionOf = (seatNo: number) =>
    reactions.find((r) => r.seat === seatNo);

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
    const target = Math.round(
      (hand?.currentBet ?? 0) + frac * (totalPot + toCall),
    );
    return Math.min(sizing.max, Math.max(sizing.min, target));
  };
  const canSize = Boolean(sizing && myTurn && !busy);
  const nudge = (dir: 1 | -1) => {
    if (!sizing) return;
    setRaiseTo(
      String(
        Math.min(
          sizing.max,
          Math.max(sizing.min, raiseValue + dir * raiseStep * 2),
        ),
      ),
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
      <div className="cs-status-bar" aria-hidden="true" />
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
          <button
            type="button"
            className="cs-hud-btn"
            onClick={() => {
              setMenuSection("seat");
              setMenuOpen(true);
            }}
          >
            👥 {occupied} / {view.seats.length}
          </button>
          {canAddChips || (seated && isTournament && view.rebuy?.enabled) ? (
            <button
              type="button"
              className="cs-hud-btn"
              onClick={() => {
                setMenuSection("seat");
                setMenuOpen(true);
              }}
            >
              {isTournament ? "Rebuy" : "+ Chips"}
            </button>
          ) : null}
        </div>
        <div className="cs-hud-group">
          <Link href="/lobby" className="cs-hud-btn" aria-label="Lobby">
            ⌂ Lobby
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
              {view.rebuyWaiting ? (
                <>
                  <br />
                  Rebuy decision…
                </>
              ) : null}
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
        <button
          type="button"
          className="cs-toast error"
          onClick={() => setError("")}
        >
          {error}
        </button>
      ) : notice ? (
        <button
          type="button"
          className="cs-toast"
          onClick={() => setNotice("")}
        >
          {notice}
        </button>
      ) : tournamentDone ? (
        <div className="cs-toast">
          {iWon ? "🏆 You won the tournament!" : "Tournament finished"} · Prize{" "}
          {fmt(view.tournament?.prizePool ?? 0)}
        </div>
      ) : null}

      {view.rebuy?.offered && rebuySeconds > 0 ? (
        <div className="cs-rebuy-offer" role="status">
          <b>Rebuy · {rebuySeconds}s</b>
          <span>
            {fmt(view.rebuy.cost)} club chips → {fmt(view.rebuy.chips)}{" "}
            tournament chips
          </span>
          <div className="cs-sheet-row">
            <button
              type="button"
              className="cs-sheet-btn"
              disabled={busy || !view.rebuy.canRebuy}
              onClick={() => void rebuy()}
            >
              Rebuy now
            </button>
            <button
              type="button"
              className="cs-sheet-btn"
              disabled={busy}
              onClick={() => void rebuy(true)}
            >
              No thanks
            </button>
          </div>
          {view.rebuy.reason ? <span>{view.rebuy.reason}</span> : null}
        </div>
      ) : null}

      {/* ---------- table ---------- */}
      <div className="cs-table">
        <div className="cs-rail">
          <div className="cs-felt" />
        </div>

        {hand && view.seats.some((s) => s.seat === hand.button && !s.empty) ? (
          <div
            className="cs-dealer-puck"
            style={{
              left: dealerPoint(slotOf(hand.button), seatCount).left,
              top: `${dealerPoint(slotOf(hand.button), seatCount).top}%`,
            }}
            role="img"
            aria-label={`Dealer: ${hand.button === view.meSeat ? "You" : view.seats.find((s) => s.seat === hand.button)?.name}`}
            title="Dealer button"
          >
            D
          </div>
        ) : null}

        {/* centre column: pot, board, chips, info — stacked so nothing overlaps */}
        <div className="cs-center">
          <div className="cs-pot-box">
            TOTAL POT <b>{fmt(totalPot)}</b>
          </div>
          <div className="cs-board">
            {(hand?.board ?? []).map((c, i) => (
              <PlayingCard
                key={`${c}-${i}`}
                card={c}
                blink={madeCards.has(c)}
              />
            ))}
          </div>
          {hand?.pot ? (
            <>
              <div className="cs-chips">
                {potStacks(hand.pot, view.table.bb).map((st, i) => (
                  <div
                    key={i}
                    className="cs-vstack"
                    style={
                      {
                        "--chip": asset(`chip-${st.color}.png`),
                      } as CSSProperties
                    }
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
                Squid pot <b>{fmt(view.squid.pot)}</b> · first to{" "}
                {view.squid.target}
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
              <div
                key={seat.seat}
                className={`cs-seat ${dense ? "dense" : ""}`}
                style={style}
              >
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
                {(() => {
                  const src = avatarSrc(
                    avatars.bySeat[String(seat.seat)] ??
                      defaultAvatar(seat.name),
                  );
                  return src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="cs-avatar-img"
                      src={sized(src, 128)}
                      alt=""
                    />
                  ) : (
                    avatarFor(seat.name, seat.isBot)
                  );
                })()}
                {rx ? <div className="cs-reaction">{rx.emoji}</div> : null}
              </div>
              {hand?.mode !== "ofc" && !!live?.hole?.length &&
              (!live.folded || live.hole.some((c) => c !== "xx")) ? (
                // fewer, smaller cards for Omaha (4–6) so they stay on screen;
                // a folded player only shows the cards they chose to show
                <div
                  className={`cs-seat-cards n${Math.min(live.hole.length, 6)}`}
                >
                  {live.hole
                    .filter((c) => !live.folded || c !== "xx")
                    .map((c, i) => (
                      <PlayingCard
                        key={i}
                        card={c}
                        cardBack={view.cosmetics?.cardBack}
                      />
                    ))}
                </div>
              ) : null}
              <div
                className={`cs-plate ${clockFor(seat.seat).className}`}
                style={clockFor(seat.seat).style}
              >
                {clockFor(seat.seat).badge}
                <div className="n">{seat.name}</div>
                {seat.sittingOut && !live?.hole?.length ? (
                  // sitting out: same size box, the words replace the chip count
                  <div className="st out">Sitting out</div>
                ) : (
                  <div className="st">{fmt(live?.stack ?? seat.stack)}</div>
                )}
                {live?.allIn ? (
                  <div className="bt allin">ALL-IN</div>
                ) : seat.memberId && view.squid?.scores?.[seat.memberId] ? (
                  <div className="bt">
                    🦑 {view.squid.scores[seat.memberId]}/{view.squid.target}
                  </div>
                ) : null}
              </div>
              {/* WIN sits just under the name box, so it never covers cards, names or pictures */}
              {win ? (
                <div className="cs-winner seat-win">
                  WIN +{fmt(win.amount)}
                  {win.hand ? <small>{win.hand}</small> : null}
                </div>
              ) : null}
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
                <i
                  style={
                    { "--chip": asset(`chip-${chip}.png`) } as CSSProperties
                  }
                />
                <span>{fmt(s.bet)}</span>
              </div>
            );
          })}

        {/* you */}
        {seated ? (
          <div
            className={`cs-hero ${me?.folded ? "folded" : ""} ${myTurn ? "active" : ""}`}
          >
            {hand?.mode !== "ofc" && !!me?.hole?.length ? (
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
                      blink={
                        !me?.folded && (preflopPremium || madeCards.has(c))
                      }
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
              <div className="n">You</div>
              {meSittingOut && !me?.hole?.length ? (
                <div className="st out">Sitting out</div>
              ) : (
                <div className="st">
                  {fmt(me?.stack ?? meSeatInfo?.stack ?? 0)}
                </div>
              )}
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
                <div className="cs-reaction">
                  {reactionOf(view.meSeat)!.emoji}
                </div>
              ) : null}
            </div>
            {madeLabel && !me?.folded ? (
              <div className="cs-made-hand">{madeLabel}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ---------- OFC ---------- */}
      {hand?.mode === "ofc" ? (
        <OfcBoard
          key={JSON.stringify([hand.handNo, hand.dealRound, hand.toAct])}
          hand={hand}
          meSeat={view.meSeat}
          busy={busy}
          submit={submitOfc}
        />
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
            {hand.result
              ? "Hand complete"
              : hand.toAct === view.meSeat
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
            <div
              className="cs-vtrack"
              style={{ "--len": "42px" } as CSSProperties}
            >
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

          {busted && !canShow ? (
            <div className="cs-actions">
              <button
                type="button"
                className="cs-action raise"
                style={{ gridColumn: "1 / -1" }}
                disabled={busy}
                onClick={() => {
                  setMenuSection("seat");
                  setAddAmt(String(addRoom));
                  setMenuOpen(true);
                }}
              >
                ADD CHIPS
              </button>
            </div>
          ) : meSittingOut && !me?.hole?.length && !canShow ? (
            <div className="cs-actions">
              <button
                type="button"
                className="cs-action call"
                style={{ gridColumn: "1 / -1" }}
                disabled={busy}
                onClick={() => void setSitOut(false)}
              >
                I&apos;M BACK — DEAL ME IN
              </button>
            </div>
          ) : canShow ? (
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
                  void showCards(
                    shownSet.size === me!.hole.length ? [] : [...me!.hole],
                  )
                }
              >
                {me!.hole.length === 2 ? "BOTH" : "ALL"}
              </button>
            </div>
          ) : (
            <div className="cs-actions">
              {preEligible ? (
                // not your turn yet: tick CHECK / FOLD (like GG Poker)
                <button
                  type="button"
                  className="cs-action fold"
                  style={
                    preCheckFold === hand?.handNo
                      ? { boxShadow: "0 0 0 3px #ffd34d", color: "#ffd34d" }
                      : undefined
                  }
                  onClick={() =>
                    setPreCheckFold(
                      preCheckFold === hand?.handNo
                        ? null
                        : (hand?.handNo ?? null),
                    )
                  }
                >
                  {preCheckFold === hand?.handNo ? "☑" : "☐"} CHECK
                  <br />/ FOLD
                </button>
              ) : (
                <button
                  type="button"
                  className="cs-action fold"
                  disabled={busy || !myTurn || !foldAction}
                  onClick={() => act("fold")}
                >
                  FOLD
                </button>
              )}
              <button
                type="button"
                className="cs-action call"
                disabled={busy || !myTurn || !passiveAction}
                onClick={() =>
                  passiveAction && act(passiveAction.type, passiveAction.amount)
                }
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
          <div
            className="cs-sheet-backdrop"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="cs-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Table menu"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-extrabold">
                  {view.table.title}
                </div>
                <div style={{ color: "#9ea8b8" }}>
                  {view.table.gameType || "NLH"} · {view.table.sb}/
                  {view.table.bb}
                  {hand ? ` · Hand #${hand.handNo}` : ""}
                  {view.table.bbjpEnabled
                    ? ` · BBJP ${fmt(view.bbjp.balance)} (min ${view.bbjp.minimumHand || view.bbjp.trigger})`
                    : ""}
                </div>
              </div>
              <button
                type="button"
                className="cs-sheet-btn"
                aria-label="Close table menu"
                onClick={() => setMenuOpen(false)}
              >
                ✕
              </button>
            </div>

            <label className="cs-menu-label" htmlFor="table-menu-section">
              Choose a section
            </label>
            <select
              id="table-menu-section"
              className="cs-menu-select"
              value={menuSection}
              onChange={(e) => setMenuSection(e.target.value)}
            >
              <option value="seat">Seat, add chips &amp; rebuy</option>
              <option value="avatar">Avatars</option>
              <option value="felt">Felts</option>
              <option value="room">Tables &amp; backgrounds</option>
              <option value="cards">Cards</option>
              <option value="sound">Sound</option>
              <option value="log">Hand log</option>
            </select>
            {notice ? (
              <p className="cs-menu-notice" role="status">
                {notice}
              </p>
            ) : null}
            {error ? (
              <p className="cs-menu-error" role="alert">
                {error}
              </p>
            ) : null}

            {menuSection === "seat" ? (
              <>
                <h3>Seat</h3>
                {seated && !isTournament ? (
                  <div className="cs-sheet-row">
                    <button
                      type="button"
                      className="cs-sheet-btn"
                      style={meSittingOut ? TICKED : undefined}
                      disabled={busy}
                      onClick={() => void setSitOut(!meSittingOut)}
                    >
                      {meSittingOut
                        ? "☑ Sitting out — tap to come back"
                        : "☐ Sit out next hand"}
                    </button>
                  </div>
                ) : null}
                {canAddChips ? (
                  <div style={{ margin: "2px 0 8px" }}>
                    <div style={{ color: "#9ea8b8", marginBottom: 4 }}>
                      Add chips (up to {fmt(view.table.buyinMax)} on the table)
                      {view.addonPending ? (
                        <b style={{ color: "#ffd34d" }}>
                          {" "}
                          · +{fmt(view.addonPending)} added before the next hand
                        </b>
                      ) : null}
                    </div>
                    <div className="cs-sheet-row">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        aria-label="Chips to add"
                        max={addRoom}
                        value={addAmt}
                        placeholder={
                          addRoom > 0 ? `max ${fmt(addRoom)}` : "at table max"
                        }
                        onChange={(e) => setAddAmt(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: 40,
                          borderRadius: 10,
                          border: "1px solid #3a4456",
                          background: "#0d1320",
                          color: "#fff",
                          padding: "0 10px",
                          fontSize: 16,
                        }}
                      />
                      <button
                        type="button"
                        className="cs-sheet-btn"
                        disabled={busy || addRoom <= 0}
                        onClick={() => setAddAmt(String(addRoom))}
                      >
                        Max
                      </button>
                      <button
                        type="button"
                        className="cs-sheet-btn"
                        style={TICKED}
                        disabled={
                          busy ||
                          addRoom <= 0 ||
                          !(Number(addAmt) > 0) ||
                          Number(addAmt) > addRoom
                        }
                        onClick={() => void addChips()}
                      >
                        Add chips
                      </button>
                    </div>
                  </div>
                ) : null}
                {seated && isTournament ? (
                  <>
                    <h3>Tournament rebuy</h3>
                    {view.rebuy?.enabled ? (
                      <p className="mb-2 text-sm">
                        {fmt(view.rebuy.cost)} club chips for{" "}
                        {fmt(view.rebuy.chips)} tournament chips · through level{" "}
                        {view.rebuy.untilLevel}.
                      </p>
                    ) : null}
                    {view.rebuy?.offered && rebuySeconds > 0 ? (
                      <div className="cs-sheet-row">
                        <button
                          type="button"
                          className="cs-sheet-btn"
                          style={TICKED}
                          disabled={busy || !view.rebuy.canRebuy}
                          onClick={() => void rebuy()}
                        >
                          Rebuy now · {rebuySeconds}s
                        </button>
                        <button
                          type="button"
                          className="cs-sheet-btn"
                          disabled={busy}
                          onClick={() => void rebuy(true)}
                        >
                          No thanks
                        </button>
                      </div>
                    ) : (
                      <p>
                        {view.rebuy?.reason ||
                          "Rebuys are not enabled for this tournament."}
                      </p>
                    )}
                    {view.rebuy?.offered && view.rebuy.reason ? (
                      <p>{view.rebuy.reason}</p>
                    ) : null}
                  </>
                ) : null}
                {seated && view.timeBank != null ? (
                  <div style={{ color: "#9ea8b8", margin: "2px 0 8px" }}>
                    ⏱ Time bank:{" "}
                    <b style={{ color: "#ffd34d" }}>{view.timeBank}</b> free
                    cards (+10 s each, used automatically when your time runs
                    out · 1 more every 25 hands · max 12)
                  </div>
                ) : null}
                <div className="cs-sheet-row">
                  <Link
                    href="/lobby"
                    className="cs-sheet-btn grid place-items-center"
                  >
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

                {seated &&
                (view.straddle?.straddle || view.straddle?.mississippi) ? (
                  <>
                    <h3>Straddle (from the next hand)</h3>
                    <div className="cs-sheet-row">
                      {view.straddle?.straddle ? (
                        <button
                          type="button"
                          className="cs-sheet-btn"
                          style={
                            view.straddle.mine.straddle ? TICKED : undefined
                          }
                          disabled={busy}
                          onClick={() =>
                            void setStraddleTick({
                              straddle: !view.straddle!.mine.straddle,
                            })
                          }
                        >
                          {view.straddle.mine.straddle ? "☑" : "☐"} Straddle
                        </button>
                      ) : null}
                      {view.straddle?.mississippi ? (
                        <button
                          type="button"
                          className="cs-sheet-btn"
                          style={
                            view.straddle.mine.mississippi ? TICKED : undefined
                          }
                          disabled={busy}
                          onClick={() =>
                            void setStraddleTick({
                              mississippi: !view.straddle!.mine.mississippi,
                            })
                          }
                        >
                          {view.straddle.mine.mississippi ? "☑" : "☐"}{" "}
                          Mississippi
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
            {menuSection === "avatar" ? (
              <>
                <h3>Your avatar</h3>
                {isDemo ? (
                  <p>Join a live table to save your avatar.</p>
                ) : (
                  <AvatarPicker
                    current={avatars.mine}
                    disabled={busy}
                    onPick={(id) => void pickAvatar(id)}
                  />
                )}
              </>
            ) : null}
            {menuSection === "felt" ? (
              <>
                <h3>Felt colour</h3>
                <FeltPicker />
              </>
            ) : null}
            {menuSection === "room" ? (
              <>
                <h3>Table background</h3>
                <RoomPicker />
              </>
            ) : null}
            {menuSection === "cards" ? (
              <>
                <h3>Card front</h3>
                <FacePicker />
                <h3>Card back</h3>
                <DeckPicker />
              </>
            ) : null}
            {menuSection === "sound" ? (
              <>
                <h3>Table sounds</h3>
                <div className="cs-sheet-row">
                  <button
                    type="button"
                    className="cs-sheet-btn"
                    aria-pressed={!muted}
                    onClick={() => {
                      setMuted(!muted);
                      setSoundsMuted(!muted);
                    }}
                  >
                    {muted ? "Sound off — turn on" : "Sound on — mute"}
                  </button>
                  <button
                    type="button"
                    className="cs-sheet-btn"
                    onClick={() => void testSound()}
                  >
                    Test sound
                  </button>
                </div>
              </>
            ) : null}
            {menuSection === "log" ? (
              <>
                <h3>Hand log</h3>
                <div className="cs-log">
                  {(hand?.log || ["Waiting for players…"]).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
