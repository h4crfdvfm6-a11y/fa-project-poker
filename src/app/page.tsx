import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { HomeBanners } from "./home-banners";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 pb-10 pt-[max(28px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <BrandMark size={48} />
      </div>

      <HomeBanners />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/lobby" className="btn btn-gold">
          Enter club lobby
        </Link>
        <Link href="/admin" className="btn btn-ghost">
          Club admin
        </Link>
      </div>
    </main>
  );
}
