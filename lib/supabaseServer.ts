import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only client using the service-role key — bypasses RLS by design.
// Never import this from a "use client" component or anywhere the bundle
// could reach the browser. Every table in supabase/migrations/0001_init.sql
// has RLS enabled with no anon/authenticated policies, so this is the only
// client in the app that can read or write them at all.
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  return cached;
}

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "label-assets";
}

export async function uploadAsset(path: string, data: Buffer, contentType: string) {
  const { error } = await supabaseAdmin().storage.from(storageBucket()).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function signedUrlFor(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabaseAdmin().storage.from(storageBucket()).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export async function logAudit(orderId: string, actor: string, action: string, detail?: Record<string, unknown>) {
  await supabaseAdmin()
    .from("lg_audit_log")
    .insert({ label_order_id: orderId, actor, action, detail: detail ?? null });
}
