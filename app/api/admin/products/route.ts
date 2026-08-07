import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

export async function GET() {
  try {
    const staff = await currentStaff();
    if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

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
