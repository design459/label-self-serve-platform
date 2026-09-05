"use client";

import { useEffect, useState } from "react";

const SSO_REASONS: Record<string, string> = {
  missing_token: "No SPINE sign-in token was found. Open Label Generator from your SPINE dashboard.",
  bad_token: "SPINE sign-in expired or was invalid. Open the tile again from SPINE.",
  wrong_surface: "That SPINE tile isn't authorized for Label Generator.",
  not_staff: "Your SPINE account isn't a Label Generator staff member yet — ask an admin to grant you the tile.",
  sso_not_configured: "SPINE single sign-on isn't configured on this deployment yet.",
  failed: "SPINE sign-in failed. Open the tile again from SPINE.",
  error: "SPINE sign-in hit an error. Open the tile again from SPINE.",
};

// Staff sign-in is SPINE-only — there is no email/password login. Staff open
// Label Generator from their SPINE dashboard; the launch token signs them in
// (see /sso + /api/sso/exchange). This page only explains that and surfaces a
// reason when an SSO handoff didn't complete (?sso=<reason>).
export default function AdminLoginPage() {
  const [ssoNote, setSsoNote] = useState<string | null>(null);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("sso");
    if (reason) setSsoNote(SSO_REASONS[reason] ?? "SPINE sign-in didn't complete. Open the tile again from SPINE.");
  }, []);

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
            Reviewer / order-desk access is through SPINE. Open <strong>Label Generator</strong> from your SPINE
            dashboard and you&apos;ll be signed in automatically — there is no separate password here.
          </p>
          {ssoNote && <div className="error-box" role="status">{ssoNote}</div>}
          <a className="btn btn-block" href="https://spine.esilkroute.com.lk/apps">
            Go to SPINE
          </a>
          <p className="split-auth-footnote">
            No public registration — access is granted in SPINE (App access) and opened via the SPINE tile.
          </p>
        </div>
      </div>
    </div>
  );
}
