import Link from "next/link";

/** Shark Club logo + wordmark used in page headers. */
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
      <span className="brand text-xl text-[var(--gold-strong)]">{label}</span>
    </Link>
  );
}
