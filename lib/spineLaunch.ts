import crypto from "node:crypto";

// SPINE launch-token SSO for the staff side. SPINE opens the tile at
// /sso#srv_token=<token>; app/sso/page.tsx posts the token to
// /api/sso/exchange, which verifies it here, maps the SPINE email to an
// lg_staff_users row, and mints our OWN signed session cookie (below).
// See docs/SPINE-SSO-SPEC.md.

export const SPINE_SURFACE = "module_label-generator";
export const SSO_COOKIE = "lg_sso";

export type LaunchClaims = { email: string; surface: string; admin: boolean };

// Launch token: base64url(JSON{email,surface,admin,exp}).base64url(HMAC_SHA256(payload, ATLAS_BRIDGE_SECRET))
export function verifyLaunchToken(token: string, secret: string, now = Date.now()): LaunchClaims | null {
  if (!token || !secret) return null;
  const dot = token.indexOf(".");
  if (dot < 1 || dot === token.length - 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let obj: { email?: unknown; surface?: unknown; admin?: unknown; exp?: unknown };
  try {
    obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!obj?.email || !obj?.surface || !obj?.exp || now > Number(obj.exp)) return null;
  return { email: String(obj.email).toLowerCase(), surface: String(obj.surface), admin: !!obj.admin };
}

// Our own app session — a signed cookie identifying the SPINE user by EMAIL.
// SPINE only mints a launch token for a surface the person is granted
// (netlify/functions/app-launch.ts -> my_access), so a verified token IS the
// authorization: no app-side staff table or Supabase Auth account is needed.
// Independent of Supabase Auth; do NOT reuse the 90s launch token as the session.
export type SessionClaims = { email: string; role: string; admin: boolean; exp: number };

export function signSession(claims: SessionClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(value: string | undefined, secret: string, now = Date.now()): SessionClaims | null {
  if (!value || !secret) return null;
  const dot = value.indexOf(".");
  if (dot < 1 || dot === value.length - 1) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let obj: { email?: unknown; role?: unknown; admin?: unknown; exp?: unknown };
  try {
    obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!obj?.email || !obj?.exp || now > Number(obj.exp)) return null;
  return {
    email: String(obj.email).toLowerCase(),
    role: String(obj.role ?? "reviewer"),
    admin: !!obj.admin,
    exp: Number(obj.exp),
  };
}
