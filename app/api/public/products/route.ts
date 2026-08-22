import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

// Unauthenticated equivalent of app/api/admin/products/route.ts — the
// public landing page needs the same catalog the staff order form already
// uses, before any staff involvement exists for a customer-originated
// order. Same query, no session gate, now also returning `category`.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin()
      .from("lg_products")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ products: data ?? [] });
  } catch (err) {
    return apiCatch(err);
  }
}
