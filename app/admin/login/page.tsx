"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }
    router.push("/admin/review");
    router.refresh();
  }

  return (
    <div className="split-auth">
      <div className="split-auth-image">
        <img className="split-auth-img" src="/hero/login-hero.png" alt="" />
        <div className="split-auth-image-scrim" />
        <div className="split-auth-image-caption">
          <p className="split-auth-brand">Label workspace</p>
          <p className="split-auth-tagline">Compliance-checked label artwork, generated in minutes — not days.</p>
        </div>
      </div>

      <div className="split-auth-form">
        <div className="split-auth-form-inner">
          <h1>Staff sign-in</h1>
          <p className="subtitle">
            Reviewer / order-desk access. Accounts are provisioned by an admin in the Supabase dashboard, not
            self-serve sign-up — see the README.
          </p>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-block" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="split-auth-divider">
            <span />
            <em>or</em>
            <span />
          </div>
          <p className="split-auth-footnote">No public registration — staff accounts only.</p>
        </div>
      </div>
    </div>
  );
}
