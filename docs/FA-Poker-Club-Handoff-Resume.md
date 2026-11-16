# FA Poker Club — Handoff Resume

Date: 15 Nov 2026 (Europe/London)  
Repo: `h4crfdvfm6-a11y/poker-app`  
Club branch: `cursor/club-only-humans-127b`  
Base branch: `cursor/fa-poker-app-mvp-127b`  
PR: https://github.com/h4crfdvfm6-a11y/poker-app/pull/6 (open, mergeable)

This document is for continuing work in another agent (e.g. Devin Desktop).

---

## Goal (product)

Private friends club poker (ClubGG-style):

- Humans only (no AI seats in the club product)
- Texas Hold'em + all PLOs (PLO / PLO5 / PLO6 / PLO Hi-Lo)
- Admin opens tables with rake
- Free club balances only (social play — not a cash casino)
- Target: App Store + Google Play (not web-only long term)
- No Mac required for building iOS if using cloud Mac CI later

---

## Already done

### Core club platform
- Next.js App Router + TypeScript + Tailwind app
- Club invite join + player lobby
- Admin PIN panel: players, open tables, BBJP
- Live ring tables: sit / leave / play hands / rake
- NLH + PLO / PLO5 / PLO6 / PLO Hi-Lo in the club admin game list
- Local PGlite for dev; Postgres path for publish

### Phase 1 club trim (this PR branch)
- Home / lobby oriented to club play (shop/coach links removed from lobby)
- Admin: MTT tab / Squid / Cucurucho / AI float UI removed from club surface
- New tables limited to NLH + PLO variants; Squid/Cucurucho forced off for new tables
- AI seating API disabled (`/api/table/[id]/bot` returns 403)
- README updated for club MVP surface
- Engine still contains extras (OFC, Spin, shop, coach, bots) for later — not the club UI path

### Hardening / reviews addressed on this branch
- Login / invite throttles (per-client + global ceiling; trusted proxy hop / cookie)
- CSRF rejects missing Origin+Referer
- Reaction list no longer grows unbounded for unknown table ids
- Table close / sit race fixes (re-entrant close, sit requires open table, leave allowed on closed)
- Merged latest base so PR #6 is mergeable

### Docs already on the branch
- `docs/FA-Poker-ClubGG-Release-Plan.md` + `.pdf` — longer release plan
- `docs/fa-poker-branch-source.zip` — source snapshot (refreshed with this handoff)
- `docs/fa-poker-club-backup.zip` — plan/docs backup

---

## What to do next (for Devin / next agent)

### Immediate
1. Merge PR #6 into `cursor/fa-poker-app-mvp-127b` (or open a PR from club branch → `main` if that is the real ship target).
2. Smoke-test locally:
   - `npm install`
   - set `ADMIN_PIN`, `SESSION_SECRET`, `CLUB_INVITE`
   - `env -u DATABASE_URL npm run dev`
   - Admin opens NLH + one PLO table with rake
   - Two players join, sit, play a hand, leave
3. Publish / host the web backend (Cursor publish or equivalent) with Postgres + secrets bound.

### Then (stores)
4. Wrap with Capacitor (iOS + Android).
5. Cloud Mac CI for iOS builds (owner has no local Mac).
6. Owner needs Apple Developer + Google Play Console accounts.
7. Store listing copy: social / free play / no real-money gambling (UK — not legal advice).

### Later (optional)
- Re-enable tournaments / Spin / OFC / side games behind admin flags if wanted
- Push notifications, polish table UX, multi-table club features

---

## How to run (local)

```bash
npm install
export ADMIN_PIN='your-admin-pin'
export SESSION_SECRET='long-random-string'
export CLUB_INVITE='your-invite'
env -u DATABASE_URL npm run dev
```

- Lobby: http://localhost:3000/lobby  
- Admin: http://localhost:3000/admin  

---

## Key paths

| Area | Path |
|------|------|
| Home | `src/app/page.tsx` |
| Lobby | `src/app/lobby/page.tsx` |
| Admin | `src/app/admin/page.tsx` |
| Table UI | `src/app/table/[id]/page.tsx` |
| Club domain | `src/lib/club.ts` |
| Table play | `src/lib/table-play.ts` |
| Engine | `src/lib/poker/engine.ts` |
| Variants | `src/lib/poker/variants.ts` |

---

## Zip for Devin

Use `docs/fa-poker-club-app-handoff.zip` (or the GitHub raw link on this branch).  
Unzip, `npm install`, run as above. Prefer cloning the Git branch if possible so history is intact:

```bash
git clone https://github.com/h4crfdvfm6-a11y/poker-app.git
cd poker-app
git checkout cursor/club-only-humans-127b
```

---

## Notes for the next AI

- Product surface = club humans-only NLH/PLO; do not re-expose shop/bots unless asked.
- Keep store goal: App Store + Play, not web-only.
- Do not estimate calendar days; describe technical steps and risks instead.
- Owner asked to avoid email spam and to pause agent auto-follow-ups when told to stop.
