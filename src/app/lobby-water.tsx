"use client";

/**
 * Lobby background: the user's own moving blue-water GIF (no logo, no title),
 * filling the screen, lightly darkened so the table list is easy to read.
 * A GIF moves on every phone (no autoplay rules), so it moves on iPhone too.
 */
import "./lobby-water.css";

const LOBBY_GIF = "/banners/Blue_Water_Two_Moving_Areas_Under25MB.gif";

export function LobbyWater() {
  return (
    <div className="lobby-water" aria-hidden>
      <div className="lw-hero" style={{ backgroundImage: `url("${LOBBY_GIF}")` }} />
      <div className="lw-shade" />
    </div>
  );
}
