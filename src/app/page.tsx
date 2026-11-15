import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-10 pt-[max(28px,env(safe-area-inset-top))]">
      <div className="mb-10 flex items-center justify-between">
        <div className="brand text-2xl text-[var(--gold-strong)]">FA Poker</div>
        <span className="chip">Free Club Chips</span>
      </div>

      <section className="panel relative overflow-hidden p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, rgba(231,197,106,.22), transparent 40%), radial-gradient(circle at 20% 80%, rgba(44,21,24,.75), transparent 45%)",
          }}
        />
        <div className="relative">
          <p className="mb-3 text-sm uppercase tracking-[0.18em] text-[var(--gold)]">
            Club platform
          </p>
          <h1 className="brand mb-3 text-4xl leading-tight">
            Play. Host.
            <br />
            Run the club.
          </h1>
          <p className="mb-6 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
            Private club poker for friends — Texas Hold&apos;em and all PLOs,
            admin tables with rake, club chips only. No bots. No cash-out.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/lobby" className="btn btn-gold">
              Enter club lobby
            </Link>
            <Link href="/admin" className="btn btn-ghost">
              Club admin
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3">
        {[
          ["Real players", "Invite friends with your club code — humans only."],
          ["Tables + rake", "NLH, PLO, PLO5, PLO6, PLO Hi-Lo with club rake."],
          ["Free club chips", "Social play balances — never redeem for cash."],
        ].map(([title, copy]) => (
          <div key={title} className="panel px-4 py-4">
            <div className="mb-1 font-semibold text-[var(--gold-strong)]">
              {title}
            </div>
            <p className="text-sm text-[var(--muted)]">{copy}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
