# FA Poker App

Private friends club poker — Texas Hold'em + PLO variants, admin-hosted tables with rake, free club chips (no cash-out). Humans only.

## Club MVP (this branch)

- **Lobby** — join with invite code, sit cash tables
- **Admin** (PIN) — add players, send chips, open NLH / PLO / PLO5 / PLO6 / PLO Hi-Lo tables with rake, BBJP
- **Live tables** — real players only (AI seats disabled), automatic rake, optional BBJP
- **Club chips only** — social play balances, never redeemable for cash
- **Stores later** — Capacitor wrap for App Store + Google Play (not web-only)

Engine still contains extra modes (OFC, Spin, Squid, Cucurucho, shop, coach, bots) for later; the club UI/API path above is the supported product surface.

## Quick start

```bash
npm install
export ADMIN_PIN='your-admin-pin'
export SESSION_SECRET='long-random-string'
export CLUB_INVITE='your-invite'
env -u DATABASE_URL npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

- Lobby: `/lobby` (use your `CLUB_INVITE`)
- Admin: `/admin` (use your `ADMIN_PIN`)

Required environment variables:

- `ADMIN_PIN` — club admin login
- `SESSION_SECRET` — signs session cookies (a random value is used for the process if unset; set this in production)
- `CLUB_INVITE` — club invite code (if unset on first boot, a random code is generated and shown in Admin)

## Stack

- Next.js + TypeScript
- Postgres when published (`cursor-app.json`); local PGlite for development

## Docs / backup

- `docs/FA-POKER-CLUB-RELEASE-PLAN.md` — release plan
- `docs/FA-POKER-CLUB-RELEASE-PLAN.pdf` — PDF of the plan
- `docs/fa-poker-club-backup.zip` — plan + key docs snapshot
- `docs/fa-poker-branch-source.zip` — source tree snapshot

## Legacy

Older single-file HTML prototypes live in `legacy/`.
