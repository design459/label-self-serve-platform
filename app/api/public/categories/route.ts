import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

// Unauthenticated on purpose — pure reference data (category display
// labels + panel field schemas), no customer/order data, needed by the
// public landing page before any order exists.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin()
      .from("category_panel_templates")
      .select("*")
      .order("display_label", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ categories: data ?? [] });
  } catch (err) {
    return apiCatch(err);
  }
}
