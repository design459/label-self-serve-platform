import { NextRequest, NextResponse } from "next/server";
import { verifyLaunchToken, signSession, SPINE_SURFACE, SSO_COOKIE } from "@/lib/spineLaunch";

export const dynamic = "force-dynamic";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h — our own session, not the 90s launch token

// POST { token } — verify the SPINE launch token and set our signed session
// cookie. SPINE only mints a token for a surface the person is GRANTED
// (app-launch -> my_access), so a valid token for our surface IS the
// authorization — there is no app-side staff table or Supabase account to
// check. Every failure returns a reason so /admin/login can say WHY.
export async function POST(req: NextRequest) {
  const bridgeSecret = process.env.ATLAS_BRIDGE_SECRET;
  const sessionSecret = process.env.LABELGEN_SESSION_SECRET;
  if (!bridgeSecret || !sessionSecret) {
    return NextResponse.json({ ok: false, reason: "sso_not_configured" }, { status: 503 });
  }

  let token = "";
  try {
    token = (await req.json())?.token ?? "";
  } catch {
    // no/invalid body -> treated as a bad token below
  }

  const claims = verifyLaunchToken(token, bridgeSecret);
  if (!claims) return NextResponse.json({ ok: false, reason: "bad_token" }, { status: 401 });
  if (claims.surface !== SPINE_SURFACE) {
    return NextResponse.json({ ok: false, reason: "wrong_surface" }, { status: 403 });
  }

  const value = signSession(
    {
      email: claims.email,
      role: claims.admin ? "admin" : "reviewer",
      admin: claims.admin,
      exp: Date.now() + SESSION_TTL_MS,
    },
    sessionSecret
  );
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SSO_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
