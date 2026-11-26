"use client";

/**
 * Lobby background: the charcoal felt picture, filling the screen, lightly
 * darkened so the table list is easy to read.
 */
import "./lobby-water.css";

const LOBBY_PICTURE = "/banners/Empty%20charcoal%20felt%20surface.png";

export function LobbyWater() {
  return (
    <div className="lobby-water" aria-hidden>
      <div className="lw-hero" style={{ backgroundImage: `url("${LOBBY_PICTURE}")` }} />
      <div className="lw-shade" />
    </div>
  );
}
