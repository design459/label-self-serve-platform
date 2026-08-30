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

    // "Other" (the blank-canvas catch-all) reads as a fallback, not a
    // product type alongside Bar/Powder/etc. — kept alphabetical order for
    // everything else, but always rendered last regardless of where its
    // label would otherwise sort.
    const categories = (data ?? []).slice().sort((a, b) => (a.category === "other" ? 1 : b.category === "other" ? -1 : 0));

    return NextResponse.json({ categories });
  } catch (err) {
    return apiCatch(err);
  }
}
