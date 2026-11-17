import type { MetadataRoute } from "next";

/** Home-screen app settings: phone only, held upright. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shark Club – Poker Simulator",
    short_name: "Shark Club",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#10069f",
    icons: [{ src: "/brand/icon.jpg", sizes: "180x180", type: "image/jpeg" }],
  };
}
