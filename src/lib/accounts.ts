import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { DEFAULT_CLUB_ID, ensureClubSeeded } from "./club";
import { withTransaction, sql } from "./db";
import { id } from "./ids";
import { ensureOnce } from "./schema-once";
import { setAdminSession, setPlayerSession } from "./session";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const WELCOME_CHIPS = 2500;
const RESET_TTL_MINUTES = 60;

export type Account = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  member_id: string | null;
  is_admin: boolean;
};

export async function ensureAccountsSchema() {
  await ensureOnce("accounts-schema", async () => {
    await sql(`
      create table if not exists accounts (
        id text primary key,
        email text not null unique,
        password_hash text not null,
        display_name text not null,
        member_id text,
        is_admin boolean not null default false,
        reset_token_hash text,
        reset_expires_at timestamptz,
        created_at timestamptz not null default now()
      )
    `);
  });
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Email that gets admin rights on sign-in (set ADMIN_EMAIL in Vercel). */
function adminEmail(): string | null {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return value ? value : null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Creates a club member and an account linked to it, with the welcome chips. */
export async function createAccount(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<Account> {
  await ensureClubSeeded();
  await ensureAccountsSchema();
  const email = normaliseEmail(input.email);
  const displayName = input.displayName.trim();
  const passwordHash = await hashPassword(input.password);
  const memberId = id("mem");
  const accountId = id("acc");
  const isAdmin = adminEmail() === email;

  const existing = await sql<{ id: string }>(
    "select id from accounts where email = $1",
    [email],
  );
  if (existing.length) throw new Error("An account with this email already exists");

  await withTransaction(async (q) => {
    await q(
      `alter table members add column if not exists gem_balance integer not null default 0`,
    );
    await q(
      `insert into members (id, club_id, display_name, role, chip_balance, gem_balance)
       values ($1, $2, $3, 'player', $4, 100)`,
      [memberId, DEFAULT_CLUB_ID, displayName, WELCOME_CHIPS],
    );
    await q(
      `insert into chip_ledger (id, club_id, member_id, amount, reason, created_by)
       values ($1, $2, $3, $4, 'welcome', 'system')`,
      [id("led"), DEFAULT_CLUB_ID, memberId, WELCOME_CHIPS],
    );
    await q(
      `insert into accounts (id, email, password_hash, display_name, member_id, is_admin)
       values ($1, $2, $3, $4, $5, $6)`,
      [accountId, email, passwordHash, displayName, memberId, isAdmin],
    );
  });

  return {
    id: accountId,
    email,
    password_hash: passwordHash,
    display_name: displayName,
    member_id: memberId,
    is_admin: isAdmin,
  };
}

/** Returns the account when the email and password match, otherwise null. */
export async function authenticate(email: string, password: string): Promise<Account | null> {
  await ensureAccountsSchema();
  const [account] = await sql<Account>(
    "select * from accounts where email = $1",
    [normaliseEmail(email)],
  );
  if (!account) return null;
  const ok = await verifyPassword(password, account.password_hash);
  return ok ? account : null;
}

/** Sets the player cookie, and the admin cookie for admin accounts. */
export async function startSession(account: Account) {
  if (account.member_id) await setPlayerSession(account.member_id);
  if (account.is_admin) await setAdminSession();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a reset token. Returns null when no account has that email. */
export async function createResetToken(email: string): Promise<string | null> {
  await ensureAccountsSchema();
  const token = randomBytes(32).toString("base64url");
  const rows = await sql<{ id: string }>(
    `update accounts
     set reset_token_hash = $1,
         reset_expires_at = now() + ($2 || ' minutes')::interval
     where email = $3
     returning id`,
    [hashToken(token), String(RESET_TTL_MINUTES), normaliseEmail(email)],
  );
  return rows.length ? token : null;
}

/** Sets a new password when the token is valid and unexpired. */
export async function resetPassword(token: string, password: string): Promise<boolean> {
  await ensureAccountsSchema();
  const passwordHash = await hashPassword(password);
  const rows = await sql<{ id: string }>(
    `update accounts
     set password_hash = $1, reset_token_hash = null, reset_expires_at = null
     where reset_token_hash = $2 and reset_expires_at > now()
     returning id`,
    [passwordHash, hashToken(token)],
  );
  return rows.length > 0;
}

/** Sends an email through Resend. Needs RESEND_API_KEY and RESEND_FROM in Vercel. */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!key || !from) throw new Error("Email is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) throw new Error("Could not send email");
}
