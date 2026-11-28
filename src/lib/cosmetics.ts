/** Client-safe cosmetic style maps (no DB / fs imports). */

export const FELT_STYLES: Record<string, string> = {
  felt_classic:
    "radial-gradient(circle at 50% 40%, #2f8a58 0%, #145834 55%, #0c3a24 100%)",
  felt_jade:
    "radial-gradient(circle at 50% 40%, #3aa87a 0%, #1a6b4a 55%, #0d3d2c 100%)",
  felt_midnight:
    "radial-gradient(circle at 50% 40%, #3a5a8a 0%, #1a2f55 55%, #0c1830 100%)",
  felt_ember:
    "radial-gradient(circle at 50% 40%, #a85a3a 0%, #6b2a1a 55%, #3d140c 100%)",
};

// Retired card backs (back_gold, back_rose) were removed: an account that still
// has one equipped falls through to the standard dark compass back.
export const CARD_BACK_STYLES: Record<string, string> = {
  back_navy: "#1a1030",
};

export const AVATAR_GLYPH: Record<string, string> = {
  avatar_default: "♠",
  avatar_fox: "🦊",
  avatar_owl: "🦉",
  avatar_crown: "👑",
};
