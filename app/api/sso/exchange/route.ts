import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { verifyLaunchToken, signSession, SPINE_SURFACE, SSO_COOKIE } from "@/lib/spineLaunch";

export const dynamic = "force-dynamic";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h — our own session, not the 90s launch token

// POST { token } — verify the SPINE launch token, confirm the email is a
// staff member, and set our signed session cookie. Every failure returns a
// reason so /admin/login can say WHY instead of showing a blank login box.
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

  // Map the SPINE email to a staff row (SECURITY DEFINER resolver, migration 0013).
  const { data, error } = await supabaseAdmin().rpc("lg_staff_by_email", { p_email: claims.email });
  const staff = Array.isArray(data) ? data[0] : data;
  if (error || !staff?.user_id) {
    return NextResponse.json({ ok: false, reason: "not_staff" }, { status: 403 });
  }

  const value = signSession(
    {
      uid: staff.user_id as string,
      email: claims.email,
      role: (staff.role as string) ?? "reviewer",
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
