"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

/** Full-screen FA Poker hero: the cropped door with the copper medallion centred on the glass. */
const PICTURE = "/banners/WhatsApp%20Image%202026-11-26%20at%208.38.41%20PM.jpeg";

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#e9cf9e",
  marginBottom: 4,
};

const FIELD: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: 46,
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid rgba(201, 164, 92, 0.75)",
  background: "rgba(0, 0, 0, 0.45)",
  color: "#f5f3ef",
  padding: "0 14px",
  fontSize: 16, // 16px stops iPhone zooming in when a field is tapped
  outline: "none",
};

const BUTTON: React.CSSProperties = {
  display: "flex",
  width: "100%",
  height: 50,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  fontSize: 19,
  fontWeight: 800,
  letterSpacing: "0.02em",
  textDecoration: "none",
  cursor: "pointer",
};

const LOG_IN: React.CSSProperties = {
  ...BUTTON,
  border: "1px solid #6b3418",
  color: "#140a04",
  background:
    "linear-gradient(180deg, #e9ad7f 0%, #c97a44 42%, #a65a2a 58%, #dc9562 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255, 240, 225, 0.75), inset 0 -2px 0 rgba(80, 36, 12, 0.5), 0 3px 8px rgba(0, 0, 0, 0.55)",
};

const CREATE: React.CSSProperties = {
  ...BUTTON,
  fontWeight: 700,
  color: "#f1d9a8",
  background: "rgba(0, 0, 0, 0.6)",
  border: "2px solid #c9a45c",
};

export function HomeScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; admin?: boolean };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Sign in failed");
      return;
    }
    window.location.assign(data.admin ? "/admin" : "/lobby");
  }

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#0b0b0d",
      }}
    >
      {/* full picture width so the whole glass frame and the handle show; sits a little below the top edge */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${PICTURE}")`,
          backgroundSize: "100% auto",
          backgroundPosition: "center 36px",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* the sign-in sits centred in the empty dark panel at the bottom of the door, evenly spaced */}
      <form
        onSubmit={submit}
        style={{
          position: "absolute",
          left: "14%",
          right: "4%",
          top: "59%",
          bottom: "3%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
          gap: 8,
        }}
      >
        <div>
          <label htmlFor="home-email" style={LABEL}>Email address</label>
          <input
            id="home-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
            style={FIELD}
          />
        </div>
        <div>
          <label htmlFor="home-password" style={LABEL}>Password</label>
          <input
            id="home-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            style={FIELD}
          />
        </div>

        {error ? (
          <p style={{ color: "#ff8b9b", margin: 0, fontSize: 14, textAlign: "center" }}>{error}</p>
        ) : null}

        <button type="submit" disabled={busy} style={{ ...LOG_IN, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Signing in…" : "Log in"}
        </button>
        <Link href="/signup" style={CREATE}>
          Create account
        </Link>
        <p style={{ textAlign: "center", margin: "0" }}>
          <Link href="/forgot" style={{ color: "#d9d4cb", fontSize: 14 }}>
            Forgot password?
          </Link>
        </p>
      </form>
    </main>
  );
}
