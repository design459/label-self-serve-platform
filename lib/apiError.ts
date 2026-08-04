import { NextResponse } from "next/server";

// Every Route Handler in this app wraps its body with this at the outer
// try/catch boundary. Without it, an unexpected throw (most commonly
// Supabase not configured yet, or a DB error) turns into Next's HTML error
// page instead of JSON — the customer/admin UI's `await res.json()` then
// throws, uncaught, leaving the page stuck on its loading state forever
// instead of showing an error. Found via a real repro: /workspace/<token>
// before .env.local was configured hung on "Loading your workspace…".
export function apiCatch(err: unknown) {
  const message = err instanceof Error ? err.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}
