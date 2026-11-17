import type { Metadata, Viewport } from "next";
import { Cinzel, Fraunces, Manrope } from "next/font/google";
import "./globals.css";

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

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shark Club – Poker Simulator",
  description:
    "Private club poker with friends — Texas Hold'em and Omaha, free club chips.",
  icons: {
    icon: "/brand/icon.jpg",
    apple: "/brand/icon.jpg",
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
    <html lang="en">
      <body className={`${display.variable} ${logo.variable} ${body.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
