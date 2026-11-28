"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { sized } from "@/lib/looks";

type Item = {
  id: string;
  kind: string;
  title: string;
  description: string;
  copper_price: number;
  price_cents: number;
  theme: string;
  chip_amount: number | string;
  asset_key: string;
};

type Me = {
  copper_balance: number;
  chip_balance: number;
  equipped_avatar: string;
  equipped_felt: string;
  equipped_card_back: string;
  display_name: string;
  owned: string[];
};

const THEME_ORDER = ["sea", "casino", "holiday", "nature", "urban"];
const THEME_LABEL: Record<string, string> = {
  sea: "Sea",
  casino: "Casino",
  holiday: "Holiday",
  nature: "Nature",
  urban: "Urban",
};

const BASIC_KINDS = ["felt", "card_face", "reaction_pack"];
const BASIC_LABEL: Record<string, string> = {
  felt: "Table skins",
  card_face: "Card faces",
  reaction_pack: "Reactions",
};
const PACK_KINDS = ["copper_pack", "chip_pack"];

export default function ShopPage() {
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Item | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/shop", { cache: "no-store" });
    const json = await res.json();
    setCatalog(json.catalog || []);
    setMe(json.me);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Escape closes the full-screen preview
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  async function post(body: unknown, fallback: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/shop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || fallback);
      return;
    }
    setMe(json.me);
  }

  const buy = (itemId: string) => post({ action: "buy", itemId }, "Purchase failed");
  const equip = (kind: "avatar" | "felt" | "card_back", assetKey: string) =>
    post({ action: "equip", kind, assetKey }, "Could not equip");

  const owned = new Set(me?.owned ?? []);

  const themes = THEME_ORDER.map((theme) => ({
    theme,
    pkg: catalog.find((i) => i.kind === "theme_package" && i.theme === theme),
    avatars: catalog.filter((i) => i.kind === "avatar" && i.theme === theme),
    backgrounds: catalog.filter((i) => i.kind === "background" && i.theme === theme),
  })).filter((t) => t.avatars.length || t.backgrounds.length);

  const cardBacks = catalog.filter((i) => i.kind === "card_back");

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-12 pt-[max(20px,env(safe-area-inset-top))]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="brand text-xl text-[var(--gold-strong)]">Shop</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Buy with copper. Play money only, never cash-out.
          </p>
        </div>
        <Link href="/lobby" className="btn btn-ghost !py-2 !text-sm">
          Lobby
        </Link>
      </div>

      {me ? (
        <div className="panel mb-5 grid grid-cols-2 gap-3 p-4">
          <div>
            <div className="text-xs text-[var(--muted)]">Copper</div>
            <div className="brand text-2xl text-[var(--gold-strong)]">
              {Number(me.copper_balance).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">Club chips</div>
            <div className="brand text-2xl text-[var(--gold)]">
              {Number(me.chip_balance).toLocaleString()}
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-5 text-sm text-[var(--muted)]">
          Join the club lobby first to buy and equip items.
        </p>
      )}

      <p className="mb-4 text-sm text-[var(--muted)]">
        Tap a picture to see it full screen. Owned backgrounds, card backs and card faces are picked at the table, in the ☰ menu.
      </p>

      {error ? <p className="mb-3 text-sm text-[#ffb4b6]">{error}</p> : null}

      {themes.map(({ theme, pkg, avatars, backgrounds }) => {
        const all = [...avatars, ...backgrounds];
        const ownedCount = all.filter((i) => owned.has(i.id)).length;
        const allOwned = ownedCount === all.length;
        return (
          <details key={theme} className="panel mb-3 p-4">
            <summary className="brand cursor-pointer text-lg">
              {THEME_LABEL[theme]}
              <span className="ml-2 text-sm text-[var(--muted)]">
                {ownedCount}/{all.length} owned
              </span>
            </summary>

            <div className="mt-4 grid gap-5">
              {pkg && !allOwned && me ? (
                <button
                  type="button"
                  className="btn btn-gold w-full"
                  disabled={busy}
                  onClick={() => buy(pkg.id)}
                >
                  Buy the whole {THEME_LABEL[theme]} set · {pkg.copper_price} copper
                </button>
              ) : null}

              {avatars.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Avatars</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {avatars.map((item) => (
                      <Tile
                        key={item.id}
                        item={item}
                        isOwned={owned.has(item.id)}
                        selected={me?.equipped_avatar === item.asset_key}
                        onOpen={() => setPreview(item)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {backgrounds.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Backgrounds</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {backgrounds.map((item) => (
                      <Tile
                        key={item.id}
                        item={item}
                        isOwned={owned.has(item.id)}
                        selected={false}
                        onOpen={() => setPreview(item)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        );
      })}

      {cardBacks.length ? (
        <details className="panel mb-3 p-4">
          <summary className="brand cursor-pointer text-lg">
            Card backs
            <span className="ml-2 text-sm text-[var(--muted)]">
              The black back is free
            </span>
          </summary>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {cardBacks.map((item) => (
              <Tile
                key={item.id}
                item={item}
                isOwned={owned.has(item.id)}
                selected={false}
                onOpen={() => setPreview(item)}
              />
            ))}
          </div>
        </details>
      ) : null}

      {BASIC_KINDS.map((kind) => {
        const items = catalog.filter((i) => i.kind === kind);
        if (!items.length) return null;
        return (
          <details key={kind} className="panel mb-3 p-4">
            <summary className="brand cursor-pointer text-lg">
              {BASIC_LABEL[kind]}
              {kind === "card_face" ? (
                <span className="ml-2 text-sm text-[var(--muted)]">The classic face is free</span>
              ) : null}
            </summary>
            <div className="mt-4 grid gap-3">
              {items.map((item) => {
                const isOwned = owned.has(item.id);
                const equipped = kind === "felt" && me?.equipped_felt === item.asset_key;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <p className="text-sm text-[var(--muted)]">{item.description}</p>
                    </div>
                    {isOwned ? (
                      kind === "felt" ? (
                        <button
                          type="button"
                          className="btn btn-ghost !py-2 !text-sm"
                          disabled={busy || equipped}
                          onClick={() => equip("felt", item.asset_key)}
                        >
                          {equipped ? "Equipped" : "Equip"}
                        </button>
                      ) : (
                        <span className="chip">Owned</span>
                      )
                    ) : (
                      <button
                        type="button"
                        className="btn btn-gold !py-2 !text-sm"
                        disabled={busy || !me}
                        onClick={() => buy(item.id)}
                      >
                        {item.copper_price ? `${item.copper_price} copper` : "Get"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}

      {PACK_KINDS.map((kind) => {
        const items = catalog.filter((i) => i.kind === kind);
        if (!items.length) return null;
        return (
          <details key={kind} className="panel mb-3 p-4">
            <summary className="brand cursor-pointer text-lg">
              {kind === "copper_pack" ? "Buy copper" : "Buy chips"}
            </summary>
            <div className="mt-4 grid gap-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <p className="text-sm text-[var(--muted)]">{item.description}</p>
                  </div>
                  <button type="button" className="btn btn-ghost !py-2 !text-sm" disabled>
                    Store coming soon
                  </button>
                </div>
              ))}
            </div>
          </details>
        );
      })}

      {preview ? (
        <Preview
          item={preview}
          isOwned={owned.has(preview.id)}
          isEquipped={preview.kind === "avatar" && me?.equipped_avatar === preview.asset_key}
          canAct={Boolean(me) && !busy}
          onBuy={() => buy(preview.id)}
          onUse={() => {
            if (preview.kind === "avatar") void equip("avatar", preview.asset_key);
          }}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </main>
  );
}

function Tile({
  item,
  isOwned,
  selected,
  onOpen,
}: {
  item: Item;
  isOwned: boolean;
  selected: boolean;
  onOpen: () => void;
}) {
  const status = isOwned
    ? selected
      ? "Using"
      : "Owned"
    : item.copper_price
      ? `${item.copper_price} copper`
      : "Free";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${item.title}, ${status}. Tap to see it full screen`}
      title={item.title}
      className="flex flex-col overflow-hidden rounded-lg p-1 text-left"
      style={{
        border: selected ? "2px solid #ffd34d" : "2px solid rgba(255,255,255,0.2)",
        background: "rgba(0,0,0,0.25)",
        boxShadow: selected ? "0 0 8px rgba(255, 211, 77, 0.6)" : "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sized(item.asset_key, 256)}
        alt=""
        className="aspect-square w-full rounded-md object-cover"
        style={{ opacity: isOwned ? 1 : 0.5 }}
      />
      <span className="mt-1 block truncate text-[11px]">{item.title}</span>
      <span className="block text-[11px] text-[var(--muted)]">{status}</span>
    </button>
  );
}

function Preview({
  item,
  isOwned,
  isEquipped,
  canAct,
  onBuy,
  onUse,
  onClose,
}: {
  item: Item;
  isOwned: boolean;
  isEquipped: boolean;
  canAct: boolean;
  onBuy: () => void;
  onUse: () => void;
  onClose: () => void;
}) {
  const isAvatar = item.kind === "avatar";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="fixed inset-0 z-[500] flex flex-col items-center justify-center gap-4 p-4"
      style={{ background: "rgba(0,0,0,0.9)" }}
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="btn btn-ghost !py-2 !text-sm absolute right-4 top-[max(16px,env(safe-area-inset-top))]"
      >
        ✕
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.asset_key}
        alt={item.title}
        onClick={(e) => e.stopPropagation()}
        className={isAvatar ? "rounded-full object-cover" : "rounded-xl object-contain"}
        style={
          isAvatar
            ? { width: "min(80vw, 60dvh)", height: "min(80vw, 60dvh)" }
            : { maxWidth: "100%", maxHeight: "70dvh" }
        }
      />

      <div className="text-center" onClick={(e) => e.stopPropagation()}>
        <div className="brand text-lg text-[var(--gold-strong)]">{item.title}</div>
        <p className="text-sm text-[var(--muted)]">{item.description}</p>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        {isOwned ? (
          isAvatar ? (
            <button
              type="button"
              className="btn btn-gold"
              disabled={!canAct || isEquipped}
              onClick={onUse}
            >
              {isEquipped ? "Using this avatar" : "Use this avatar"}
            </button>
          ) : (
            <span className="chip">Owned · pick it at the table in the ☰ menu</span>
          )
        ) : (
          <button type="button" className="btn btn-gold" disabled={!canAct} onClick={onBuy}>
            {item.copper_price ? `Buy · ${item.copper_price} copper` : "Get it free"}
          </button>
        )}
      </div>
    </div>
  );
}
