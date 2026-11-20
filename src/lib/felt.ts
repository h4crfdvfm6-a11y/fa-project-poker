/**
 * Table felt colours a player can choose (saved on their phone). "classic" is
 * the original green table photo; the others are the same table in other felts
 * (public/banners/felt-<id>.jpg, styled in globals.css).
 */
export const FELTS = [
  { id: "classic", label: "Green", color: "#1f8a4c" },
  { id: "blue", label: "Royal blue", color: "#0538a0" },
  { id: "red", label: "Red", color: "#8b0511" },
  { id: "charcoal", label: "Charcoal", color: "#3a3937" },
  { id: "purple", label: "Amethyst", color: "#4a0a4c" },
  { id: "teal", label: "Teal", color: "#046e6c" },
] as const;

export const FELT_KEY = "sc_felt";

/**
 * Rooms around the table (same table, same angle, different scene). Each room
 * has its own picture per felt colour: public/banners/room-<room>.jpg (green)
 * and room-<room>-<felt>.jpg, styled in src/app/table-looks.css. "casino" is the original.
 */
export const ROOMS = [
  { id: "casino", label: "Casino", src: "/banners/casino-table.jpg" },
  { id: "reef", label: "Under the sea", src: "/banners/room-reef.jpg" },
  { id: "lighthouse", label: "Lighthouse", src: "/banners/room-lighthouse.jpg" },
  { id: "cove", label: "Boathouse cove", src: "/banners/room-cove.jpg" },
  { id: "ship", label: "Ship deck", src: "/banners/room-ship.jpg" },
] as const;

export const ROOM_KEY = "sc_room";

/** Runs before the page paints (in layout.tsx) so the chosen table and cards show at once. */
export const FELT_INIT_SCRIPT = `try{var f=localStorage.getItem("${FELT_KEY}");if(f&&f!=="classic")document.documentElement.setAttribute("data-felt",f);var d=localStorage.getItem("sc_deck");if(d&&d!=="dark")document.documentElement.setAttribute("data-deck",d);var r=localStorage.getItem("sc_room");if(r&&r!=="casino")document.documentElement.setAttribute("data-room",r);var c=localStorage.getItem("sc_face");if(c&&c!=="classic")document.documentElement.setAttribute("data-face",c)}catch(e){}`;
