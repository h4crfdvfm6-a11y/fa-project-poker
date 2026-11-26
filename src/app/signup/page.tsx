"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Sign up failed");
      return;
    }
    window.location.assign("/lobby");
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "24px 16px" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/banners/Copper%20Poker%20Art%20Deco%20Medallion.png"
        alt="FA Poker"
        style={{
          display: "block",
          width: 200,
          height: 200,
          objectFit: "cover",
          borderRadius: "50%",
          margin: "0 auto 20px",
        }}
      />
      <form className="panel" onSubmit={submit} style={{ padding: 20 }}>
        <label className="label" htmlFor="name">Display name</label>
        <input
          id="name"
          className="field"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How you appear at the table"
          maxLength={24}
          required
        />
        <div style={{ height: 14 }} />
        <label className="label" htmlFor="email">Email address</label>
        <input
          id="email"
          className="field"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          required
        />
        <div style={{ height: 14 }} />
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password"
          className="field"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
        {error && <p style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p>}
        <div style={{ height: 18 }} />
        <button className="btn btn-gold" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p style={{ textAlign: "center", marginTop: 14 }}>
          <Link href="/login" className="muted">Already have an account? Log in</Link>
        </p>
      </form>
    </main>
  );
}
