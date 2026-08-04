import { supabaseAdmin } from "./supabaseServer";
import { LabelOrder } from "./types";

// The only place a customer's access_token is turned into a row. Every
// app/api/workspace/[token]/* route calls this first — a token that
// doesn't match a row simply gets a 404, so a customer's link can never
// resolve another customer's order (see supabase/migrations/0001_init.sql
// for why this is enforced here rather than via RLS).
export async function getOrderByToken(token: string): Promise<LabelOrder | null> {
  if (!token) return null;
  const { data } = await supabaseAdmin().from("label_orders").select("*").eq("access_token", token).maybeSingle();
  return (data as LabelOrder) ?? null;
}
