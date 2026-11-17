/**
 * Moving deep-water background (lobby): the water from the Shark Club home
 * picture, no shark. Two copies drift slowly against each other so the water
 * shimmers, gold sparkles twinkle, and the middle stays dark for reading.
 */
import "./lobby-water.css";

const PICTURE = "/banners/913264387_1634729197943554_7988411377112276360_n.jpg";

const SPARKLES = [
  [8, 14, 0],
  [22, 62, 1.6],
  [88, 20, 0.8],
  [76, 74, 2.4],
  [14, 88, 1.2],
  [92, 48, 3.1],
  [48, 6, 2],
  [60, 94, 0.4],
  [4, 40, 2.8],
  [96, 86, 1.9],
];

export function LobbyWater() {
  return (
    <div className="lobby-water" aria-hidden>
      <div className="lw-layer lw-a" style={{ backgroundImage: `url("${PICTURE}")` }} />
      <div className="lw-layer lw-b" style={{ backgroundImage: `url("${PICTURE}")` }} />
      <div className="lw-shade" />
      {SPARKLES.map(([x, y, d], i) => (
        <i
          key={i}
          className="lw-spark"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}
        />
      ))}
    </div>
  );
}
