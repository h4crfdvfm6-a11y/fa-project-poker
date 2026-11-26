import Link from "next/link";
import "./brand-mark.css";

/** The COPPER POKER art deco medallion, used in page headers. */
export const LOGO_NAME_SRC = "/banners/Copper%20Poker%20Art%20Deco%20Medallion.png";

export function BrandMark({
  href = "/",
  label = "Copper Poker",
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
