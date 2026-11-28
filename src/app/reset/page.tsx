"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ResetPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not reset password");
      return;
    }
    setDone(true);
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
        {done ? (
          <>
            <p>Your password has been changed.</p>
            <div style={{ height: 14 }} />
            <Link href="/login" className="btn btn-gold" style={{ width: "100%" }}>
              Log in
            </Link>
          </>
        ) : (
          <>
            <label className="label" htmlFor="password">New password</label>
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
            <button className="btn btn-gold" type="submit" disabled={busy || !token} style={{ width: "100%" }}>
              {busy ? "Saving…" : "Save new password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
