import Link from "next/link";
import "./brand-mark.css";

/** The FA Poker art deco medallion, used in page headers. */
export const LOGO_NAME_SRC = "/banners/Copper%20Poker%20Art%20Deco%20Medallion.png";

export function BrandMark({
  href = "/",
  label = "FA Poker",
  size = 36,
}: {
  href?: string;
  label?: string;
  size?: number;
}) {
  const dimension = Math.round(size * 1.6);
  return (
    <Link href={href} className="flex items-center" aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_NAME_SRC}
        alt={label}
        style={{
          height: dimension,
          width: dimension,
          objectFit: "cover",
          borderRadius: "50%",
        }}
        className="brand-logo"
      />
    </Link>
  );
}
