# FA Poker — ClubGG-style release plan

Friends-only social poker. Club chips only. No real-money cash-out.  
UK: social play framing (**not legal advice**).

---

## 1. Product (v1)

Private social poker club for you and friends — ClubGG-style. Admin opens tables with rake; **real people** play with club chips.

### Included
- Club invite + lobby
- Admin opens ring tables with rake
- Real players only (**no AI bots**)
- Club chips (free play) — rake stays in the club
- **Texas Hold'em (NLH)**
- **All PLOs:** PLO (4), PLO5, PLO6, PLO Hi-Lo

### Excluded in v1
- AI / bot seats
- Shop / gems / cosmetics monetization
- Spin & Gold, OFC, Squid, Cucurucho (optional later)
- Real GBP deposits or withdrawals
- Web-only as the main product (stores are the goal)

### Game list (v1)
1. Texas Hold'em — No-Limit Hold'em (NLH)
2. PLO — Pot-Limit Omaha (4 hole cards)
3. PLO5 — Pot-Limit Omaha 5
4. PLO6 — Pot-Limit Omaha 6
5. PLO Hi-Lo — Pot-Limit Omaha High/Low

### How a session works
1. You log into Admin (PIN).
2. Open a table: pick NLH or a PLO, blinds, rake %.
3. Friends join with the club invite and sit with club chips.
4. Hands play; rake is taken from pots into club rake (club chips).
5. Leave / close table returns stacks to player balances.

---

## 2. Legal (UK) — high level

**Not legal advice.**

Free-play club chips with no cash prizes and no cash-out is generally treated as social play, not licensed gambling. Risk rises if you sell chips for money-worth prizes or market real-money poker. For App Store listing, consider a short check with UKGC guidance or a solicitor. Store copy should say: **social / free play / no real-money gambling**.

---

## 3. Phases

### Phase 1 — Product trim (this repo)
- Remove or hide: Add AI, shop entry points, unused modes from admin/lobby.
- Keep: invite, lobby, admin tables + rake, sit/leave, **NLH + all PLOs**, security.
- Stabilize PR security/Bugbot findings, then merge.
- Smoke-test: 2–3 real accounts, NLH + one PLO table with rake, full hand to leave.

### Phase 2 — Hosted club server
- Publish/host the Next.js backend + Postgres.
- Set secrets: `ADMIN_PIN`, `SESSION_SECRET`, `CLUB_INVITE`.
- Live club URL that mobile apps will call.

### Phase 3 — iOS + Android app shells
- Wrap with Capacitor (or Expo) pointing at the hosted club.
- Mobile UI: lobby, tables (NLH + PLOs), admin (or admin on web first).
- Native store binaries — not “open in Safari” as the product.

### Phase 4 — Store accounts & builds (you)
| Store | You need |
| --- | --- |
| Apple | Apple Developer (~£79/year). No personal Mac if you use cloud Mac CI (EAS / Codemagic / GitHub macOS). |
| Google | Play Console (~£20 one-time). Build on Windows/Linux/CI. |

- Icons, screenshots, privacy policy, age rating.
- Submit for review; stress free play / social club chips.

### Phase 5 — Soft launch
- Invite-only friends.
- You open NLH/PLO tables; they play.
- Fix bugs from real sessions before any public push.

### Phase 6 — Later (optional)
- Short Deck, All-in or Fold, Bomb Pot
- Tournaments / Spin & Gold
- OFC / Squid / Cucurucho
- Optional practice bots (off by default)
- Cosmetics shop only if you want monetization later

---

## 4. Parallel AI usage
- One agent per branch at a time.
- When Cursor usage ends, hand off to another AI with this plan: club-only, no bots, rake, humans only, NLH + all PLOs.
- Do not let two AIs edit the same PR simultaneously.

---

## 5. Your checklist
1. Confirm v1 = club + rake + humans only + Texas Hold'em + all PLOs.
2. Finish/merge security-clean club code.
3. Host backend + set admin/invite secrets.
4. Capacitor iOS/Android shells.
5. Apple + Google developer accounts.
6. Cloud Mac iOS builds; Play Android builds.
7. Submit stores; friends-only soft launch.

---

## 6. Effort shape
- Trim to club-only (hide bots/shop): small UI/admin changes.
- Host + mobile wrap: medium (Capacitor + env + CI).
- Store submit: mainly your accounts, assets, and review wait — not more poker-engine work.

**Next step when ready:** start Phase 1 — strip bots/shop; keep NLH + all PLOs.
