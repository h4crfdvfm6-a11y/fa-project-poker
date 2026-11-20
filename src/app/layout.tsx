import type { Metadata, Viewport } from "next";
import { Cinzel, Fraunces, Manrope, Roboto_Condensed } from "next/font/google";
import "./globals.css";
import { FELT_INIT_SCRIPT } from "@/lib/felt";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

/** Matches the Card Sharks / Shark Club logo lettering (classic Roman capitals). */
const logo = Cinzel({
  variable: "--font-logo",
  subsets: ["latin"],
  weight: ["700", "900"],
});

/** Playing-card ranks (tall bold letters like GG Poker's cards). */
const cardFont = Roboto_Condensed({
  variable: "--font-card",
  subsets: ["latin"],
  weight: ["700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shark Club – Poker Simulator",
  description:
    "Private club poker with friends — Texas Hold'em and Omaha, free club chips.",
  icons: {
    // the owner's app icon (512×512, uploaded to public/banners)
    icon: "/banners/app-icon.png",
    apple: "/banners/app-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Shark Club",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#08143a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* the player's chosen table felt, set before the page paints */}
        <script dangerouslySetInnerHTML={{ __html: FELT_INIT_SCRIPT }} />
      </head>
      <body className={`${display.variable} ${logo.variable} ${body.variable} ${cardFont.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
