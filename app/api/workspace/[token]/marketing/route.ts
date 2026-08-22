import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { FONT_PRESETS } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

// Writes the customer's free-text brand name/tagline and their default font
// (the seed value new canvas elements pick up — see lib/canvasLayout.ts).
// Photo position now lives on the photo element itself, saved via
// app/api/workspace/[token]/layout/route.ts, not here. font_id is checked
// against the FONT_PRESETS allowlist rather than accepted as a free-text
// string: font-family values are string-interpolated directly into inline
// styles in lib/artboard.ts, so free text there would be an injection risk
// the way a plain text field (escaped via esc()) isn't.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved and locked." }, { status: 409 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const fontId = FONT_PRESETS.some((f) => f.id === body.fontId) ? body.fontId : order.font_id;

    const db = supabaseAdmin();
    const { error: updateError } = await db
      .from("label_orders")
      .update({
        display_name: typeof body.displayName === "string" ? body.displayName : order.display_name,
        marketing_tagline: typeof body.marketingTagline === "string" ? body.marketingTagline : order.marketing_tagline,
        font_id: fontId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) {
      return NextResponse.json({ error: `Failed to save marketing details: ${updateError.message}` }, { status: 500 });
    }

    await logAudit(order.id, "customer", "marketing_updated", {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiCatch(err);
  }
}
