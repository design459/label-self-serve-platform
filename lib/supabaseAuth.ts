import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseServer";
import { verifySession, SSO_COOKIE } from "./spineLaunch";

// Session-aware client (anon key + the visitor's own auth cookies) — used
// only to answer "who is logged in", never for data access. All actual
// reads/writes go through supabaseAdmin() (lib/supabaseServer.ts) once a
// caller is confirmed to be staff.
export function supabaseSession() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // called from a Server Component render (not a Route Handler) —
          // cookie writes are a no-op there; middleware/route handlers
          // covering sign-in/sign-out are where this actually matters.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // see above
        }
      },
    },
  });
}

export interface StaffMember {
  // Present only for native Supabase Auth sign-ins. SPINE SSO staff are
  // identified by email (no app-side user account), so userId is undefined.
  userId?: string | null;
  email: string | null;
  role: string;
}

// Returns the logged-in staff member, or null if not signed in. Two ways in:
// SPINE SSO (the main path — identity by email, no app account) and native
// Supabase Auth (fallback for the few provisioned app accounts).
export async function currentStaff(): Promise<StaffMember | null> {
  // 1) SPINE SSO session (set by /api/sso/exchange) takes precedence. The signed
  // cookie is only issued after a valid SPINE launch token, and SPINE only mints
  // one for a surface the person is GRANTED (app-launch -> my_access) — so the
  // cookie is authorization proof on its own; no local staff lookup is needed.
  // Revocation: remove the SPINE grant; it takes effect at the next sign-in
  // (sessions live 8h).
  const ssoSecret = process.env.LABELGEN_SESSION_SECRET;
  if (ssoSecret) {
    const sso = verifySession(cookies().get(SSO_COOKIE)?.value, ssoSecret);
    if (sso) {
      return { email: sso.email, role: sso.role };
    }
  }

  // 2) Native Supabase Auth session (staff sign-in at /admin/login).
  const session = supabaseSession();
  const { data: userData } = await session.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data: staffRow } = await supabaseAdmin()
    .from("lg_staff_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffRow) return null;
  return { userId: user.id, email: user.email ?? null, role: staffRow.role as string };
}

// Every /admin page calls this instead of currentStaff() directly. Supabase
// not being configured yet is an expected pre-deploy state (see README) —
// this turns that into a message on the page instead of an uncaught
// exception (which otherwise renders as a blank page in dev).
export async function safeCurrentStaff(): Promise<{ staff: StaffMember | null; configError?: string }> {
  try {
    return { staff: await currentStaff() };
  } catch (err) {
    return { staff: null, configError: err instanceof Error ? err.message : "Supabase is not configured." };
  }
}
