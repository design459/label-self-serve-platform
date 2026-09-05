import { cookies } from "next/headers";
import { verifySession, SSO_COOKIE } from "./spineLaunch";

export interface StaffMember {
  // SPINE SSO staff are identified by email (no app-side user account).
  // userId is kept optional for any legacy code path that expected it.
  userId?: string | null;
  email: string | null;
  role: string;
}

// Returns the signed-in staff member, or null. Sign-in is SPINE-only: the
// signed session cookie is issued by /api/sso/exchange after a valid SPINE
// launch token, and SPINE only mints a token for a surface the person is
// GRANTED (app-launch -> my_access) — so the cookie is authorization proof on
// its own; there is no app-side staff table or password login.
// Revocation: remove the SPINE grant; it takes effect at the next sign-in
// (sessions live 8h).
export async function currentStaff(): Promise<StaffMember | null> {
  const ssoSecret = process.env.LABELGEN_SESSION_SECRET;
  if (!ssoSecret) return null;
  const sso = verifySession(cookies().get(SSO_COOKIE)?.value, ssoSecret);
  if (!sso) return null;
  return { email: sso.email, role: sso.role };
}

// Every /admin page calls this instead of currentStaff() directly, so a
// missing/misconfigured session surfaces as a message rather than a crash.
export async function safeCurrentStaff(): Promise<{ staff: StaffMember | null; configError?: string }> {
  try {
    return { staff: await currentStaff() };
  } catch (err) {
    return { staff: null, configError: err instanceof Error ? err.message : "Sign-in is not configured." };
  }
}
