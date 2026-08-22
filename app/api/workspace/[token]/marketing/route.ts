import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { FONT_PRESETS, THEME_PRESETS } from "@/lib/types";
import { HEX, safeGradientStops } from "@/lib/canvasLayout";
import { apiCatch } from "@/lib/apiError";

const MAX_CUSTOM_COLORS = 12;

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

    // backgroundColor/backgroundType/backgroundGradient/customColors are the
    // theme fields the editor's "Edit background" panel exposes —
    // primaryColor/accentColor are preserved from whatever the order
    // already had (or a sane default), never accepted as free text here,
    // same allowlist/format-validation reasoning as fontId.
    const currentTheme = order.theme ?? THEME_PRESETS[0];
    const backgroundColor = typeof body.backgroundColor === "string" && HEX.test(body.backgroundColor) ? body.backgroundColor : currentTheme.backgroundColor;
    const backgroundType = body.backgroundType === "gradient" ? "gradient" : body.backgroundType === "color" ? "color" : currentTheme.backgroundType ?? "color";

    const rawStops = body.backgroundGradient && typeof body.backgroundGradient === "object" ? safeGradientStops(body.backgroundGradient.stops) : [];
    const backgroundGradient =
      backgroundType === "gradient" && rawStops.length >= 2
        ? {
            angle:
              typeof body.backgroundGradient?.angle === "number" && Number.isFinite(body.backgroundGradient.angle)
                ? ((body.backgroundGradient.angle % 360) + 360) % 360
                : 45,
            stops: rawStops,
          }
        : currentTheme.backgroundGradient ?? null;

    const customColors = Array.isArray(body.customColors)
      ? Array.from(new Set(body.customColors.filter((c: unknown): c is string => typeof c === "string" && HEX.test(c)))).slice(0, MAX_CUSTOM_COLORS)
      : currentTheme.customColors ?? [];

    const theme = { ...currentTheme, backgroundColor, backgroundType, backgroundGradient, customColors };

    const db = supabaseAdmin();
    const { error: updateError } = await db
      .from("label_orders")
      .update({
        display_name: typeof body.displayName === "string" ? body.displayName : order.display_name,
        marketing_tagline: typeof body.marketingTagline === "string" ? body.marketingTagline : order.marketing_tagline,
        font_id: fontId,
        theme,
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
