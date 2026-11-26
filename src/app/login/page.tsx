"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
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
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "24px 16px" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/banners/Copper%20Poker%20Art%20Deco%20Medallion.png"
        alt="Copper Poker"
        style={{ display: "block", width: 200, height: "auto", margin: "0 auto 20px" }}
      />
      <form className="panel" onSubmit={submit} style={{ padding: 20 }}>
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
        />
        {error && <p style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p>}
        <div style={{ height: 18 }} />
        <button className="btn btn-gold" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in…" : "Log in"}
        </button>
        <div style={{ height: 10 }} />
        <Link href="/signup" className="btn btn-ghost" style={{ width: "100%" }}>
          Create account
        </Link>
        <p style={{ textAlign: "center", marginTop: 14 }}>
          <Link href="/forgot" className="muted">Forgot password?</Link>
        </p>
      </form>
    </main>
  );
}
