"use client";

/**
 * Lobby background: the user's own underwater picture (still, ~100 KB, so the
 * lobby opens fast), filling the screen, lightly darkened so the table list is
 * easy to read. It replaced the 22 MB moving GIF.
 */
import "./lobby-water.css";

const LOBBY_PICTURE = "/banners/IMG_4873.jpg";

export function LobbyWater() {
  return (
    <div className="lobby-water" aria-hidden>
      <div className="lw-hero" style={{ backgroundImage: `url("${LOBBY_PICTURE}")` }} />
      <div className="lw-shade" />
    </div>
  );
}
