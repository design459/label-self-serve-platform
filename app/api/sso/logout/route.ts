import { NextResponse } from "next/server";
import { SSO_COOKIE } from "@/lib/spineLaunch";

export const dynamic = "force-dynamic";

// Clears the SPINE SSO session cookie. Called by AdminNav's "Sign out"
// alongside Supabase's own signOut() — the SSO cookie is httpOnly, so the
// browser can't clear it on its own.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SSO_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
