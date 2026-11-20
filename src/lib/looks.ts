/**
 * The owner's avatars and card backs (originals in public/banners, made
 * phone-sized on the fly by Next's image resizer).
 */

/** a resized copy of a picture in public/ */
export function sized(src: string, width: 64 | 128 | 256 | 384) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

export const AVATARS = [
  { id: "shark", label: "Shark Captain", src: "/banners/Great White Shark Captain-1.png" },
  { id: "octopus", label: "Octopus", src: "/banners/Amber-Eyed Octopus Poker Strategist-2.png" },
  { id: "turtle", label: "Turtle", src: "/banners/Emerald Turtle Navigator-3.png" },
  { id: "cuttlefish", label: "Cuttlefish", src: "/banners/Burnt-orange cuttlefish illusionist-4.png" },
  { id: "seahorse", label: "Seahorse", src: "/banners/Golden Seahorse Ocean Poker Herald-5.png" },
  { id: "lobster", label: "Lobster", src: "/banners/Crimson lobster admiral-6.png" },
  { id: "anglerfish", label: "Anglerfish", src: "/banners/Midnight anglerfish poker avatar-7.png" },
  { id: "orca", label: "Orca", src: "/banners/Glacier Blue Orca Guardian-8.png" },
  { id: "dolphin", label: "Dolphin", src: "/banners/Red-Neckerchief Dolphin Racer-9.png" },
  { id: "pufferfish", label: "Pufferfish", src: "/banners/Golden Pufferfish Scout-10.png" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === "string" && AVATARS.some((a) => a.id === v);
}

export function avatarSrc(id: string | null | undefined) {
  return AVATARS.find((a) => a.id === id)?.src ?? null;
}

/** players who haven't picked one get one of the ten, always the same for their name */
export function defaultAvatar(name: string): AvatarId {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length]!.id;
}

/** Card backs: "dark" is the standard one. Chosen per phone. */
export const DECKS = [
  { id: "dark", label: "Dark", src: "/banners/Monochrome compass scrollwork card back-1.png" },
  { id: "silver", label: "Silver", src: "/banners/Silver compass scrollwork card back-2.png" },
  { id: "coral", label: "Coral", src: "/banners/Coral Victorian Compass Card Back-2.png" },
  { id: "amber", label: "Amber", src: "/banners/Amber Victorian compass card back-3.png" },
  { id: "green", label: "Green", src: "/banners/card-back-green.png" },
  { id: "blue", label: "Blue", src: "/banners/card-back-blue.png" },
] as const;

export const DECK_KEY = "sc_deck";
