import Link from "next/link";
import "./brand-mark.css";

/** Shark Club logo + wordmark (logo-style gold Roman capitals) used in page headers. */
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
    <Link href={href} className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo.jpg"
        alt=""
        width={size}
        height={size}
        className="rounded-[22%] shadow-[0_0_12px_rgba(246,199,74,.35)]"
      />
      <span className="brand-wordmark" style={{ fontSize: Math.round(size * 0.56) }}>
        {label}
      </span>
    </Link>
  );
}
