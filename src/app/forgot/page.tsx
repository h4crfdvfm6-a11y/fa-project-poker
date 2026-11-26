"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    setSent(true);
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
        {sent ? (
          <p>If an account uses that email, a reset link is on its way. The link works for one hour.</p>
        ) : (
          <>
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
            <div style={{ height: 18 }} />
            <button className="btn btn-gold" type="submit" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
        <p style={{ textAlign: "center", marginTop: 14 }}>
          <Link href="/login" className="muted">Back to log in</Link>
        </p>
      </form>
    </main>
  );
}
