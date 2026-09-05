"use client";

import { useEffect, useState } from "react";

// SPINE opens the tile at /sso#srv_token=<token>. The token is in the URL
// hash, which the browser never sends to the server — so read it here, strip
// the hash BEFORE any redirect (a router redirect carrying the #hash loops or
// leaks the token), post it to the exchange, then land on the review queue.
export default function SsoLanding() {
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("srv_token");
    window.history.replaceState(null, "", window.location.pathname); // strip hash first

    if (!token) {
      window.location.replace("/admin/login?sso=missing_token");
      return;
    }

    fetch("/api/sso/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => ({ ok: r.ok, body: (await r.json().catch(() => ({}))) as { ok?: boolean; reason?: string } }))
      .then(({ ok, body }) => {
        if (ok && body.ok) {
          window.location.replace("/admin/review");
        } else {
          setMessage("Sign-in failed — redirecting…");
          window.location.replace(`/admin/login?sso=${body.reason ?? "failed"}`);
        }
      })
      .catch(() => {
        setMessage("Sign-in failed — redirecting…");
        window.location.replace("/admin/login?sso=error");
      });
  }, []);

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "60vh",
        fontFamily: "system-ui, sans-serif",
        color: "var(--muted)",
      }}
    >
      {message}
    </main>
  );
}
