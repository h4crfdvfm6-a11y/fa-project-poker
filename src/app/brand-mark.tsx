import Link from "next/link";
import "./brand-mark.css";

/** The owner's Shark Club logo (two sharks + SHARK CLUB), used in page headers. */
export const LOGO_NAME_SRC = "/banners/logo-gap65.png";

export function BrandMark({
  href = "/",
  label = "Shark Club",
  size = 36,
}: {
  href?: string;
  label?: string;
  size?: number;
}) {
  return (
    <Link href={href} className="flex items-center" aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_NAME_SRC}
        alt={label}
        style={{ height: Math.round(size * 1.6), width: "auto" }}
        className="brand-logo"
      />
    </Link>
  );
}
