import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { PRODUCT_CATEGORIES, PACK_FORMATS } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

// Fixed for every public self-serve order — not client-controlled, unlike
// the staff form's revisionLimit field, to prevent cap-inflation abuse from
// an endpoint that requires no authentication at all.
const PUBLIC_REVISION_LIMIT = 3;
const MAX_ORDERS_PER_IP_PER_HOUR = 5;
const MIN_FORM_FILL_MS = 3000;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-nf-client-connection-ip") || "unknown";
}

// The one security-sensitive new route in this app: an unauthenticated
// POST that can create a real order. Everything below is written assuming
// the request body is adversarial.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const { customerName, companyName, customerEmail, catalogProductId, customProductName, category, packFormat, code, honeypot, renderedAt } = body;

    // Silent no-ops, not errors — never tip off a bot that it was caught.
    if (typeof honeypot === "string" && honeypot.trim() !== "") {
      return NextResponse.json({ accessToken: null });
    }
    if (typeof renderedAt !== "number" || Date.now() - renderedAt < MIN_FORM_FILL_MS) {
      return NextResponse.json({ accessToken: null });
    }

    if (!customerName || !customerEmail || !companyName) {
      return NextResponse.json({ error: "Your name, company name and email are required." }, { status: 400 });
    }
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Enter the code we sent before starting your label." }, { status: 400 });
    }

    const db = supabaseAdmin();

    const ip = clientIp(req);
    const { data: allowed, error: rateError } = await db.rpc("lg_check_rate_limit", {
      p_bucket: "public_order_create",
      p_identifier: ip,
      p_max_per_hour: MAX_ORDERS_PER_IP_PER_HOUR,
    });
    if (rateError) return NextResponse.json({ error: rateError.message }, { status: 500 });
    if (!allowed) {
      return NextResponse.json({ error: "Too many label workspaces created recently. Try again in a bit." }, { status: 429 });
    }

    // The code was emailed only to staff (see request-code/route.ts) — this
    // is the actual access gate, not the rate limit above. Consumed with a
    // single conditional UPDATE (not a separate select-then-update) so two
    // concurrent submissions can't both succeed with the same code.
    const email = String(customerEmail).trim().toLowerCase();
    const { data: consumedCode, error: codeError } = await db
      .from("lg_access_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("email", email)
      .eq("code", code)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (codeError) return NextResponse.json({ error: codeError.message }, { status: 500 });
    if (!consumedCode) {
      return NextResponse.json({ error: "That code is invalid, already used, or expired. Request a new one." }, { status: 400 });
    }

    // Two mutually exclusive paths: a known catalog product (auto-fill real
    // data — the server re-fetches it, never trusting the client's copy of
    // that data) or a custom/typed product (blank regulatory content only —
    // never invented values, see lib/artboard.ts's compliance-boundary
    // comment).
    let productName = "";
    let resolvedPackFormat = packFormat;
    let resolvedCategory = category;
    let regulatoryInsert: Record<string, unknown> = {
      ingredients: "",
      nutrition_panel: {},
      claims: "",
      batch_code: "",
      manufacture_date: null,
      expiry_date: null,
      statutory_marks: "",
    };

    if (catalogProductId) {
      const { data: product } = await db.from("lg_products").select("*").eq("id", catalogProductId).eq("is_active", true).maybeSingle();
      if (!product) return NextResponse.json({ error: "That product wasn't found." }, { status: 400 });

      productName = product.name;
      resolvedPackFormat = product.pack_format;
      resolvedCategory = product.category;
      regulatoryInsert = {
        ingredients: product.ingredients ?? "",
        nutrition_panel: {
          calories: product.calories,
          servingSize: product.serving_size,
          suggestedUse: product.suggested_use ?? "",
          warnings: product.warnings ?? "",
        },
        claims: product.claims ?? "",
        batch_code: "",
        manufacture_date: null,
        expiry_date: null,
        // The free-text "Description" field — starts blank even for a
        // known catalog product; the customer drafts it with the
        // generate-description endpoint or writes their own. Real
        // suggested-use/warning text lives in nutrition_panel above, not
        // here.
        statutory_marks: "",
      };
    } else {
      if (!customProductName || typeof customProductName !== "string" || !customProductName.trim()) {
        return NextResponse.json({ error: "Enter a product name or pick one from the catalog." }, { status: 400 });
      }
      if (!PRODUCT_CATEGORIES.includes(resolvedCategory)) {
        return NextResponse.json({ error: `category must be one of ${PRODUCT_CATEGORIES.join(", ")}` }, { status: 400 });
      }
      const { data: panel } = await db.from("category_panel_templates").select("default_pack_format").eq("category", resolvedCategory).maybeSingle();
      resolvedPackFormat = PACK_FORMATS.includes(packFormat) ? packFormat : panel?.default_pack_format || "pouch";
      productName = customProductName.trim();
    }

    if (!PACK_FORMATS.includes(resolvedPackFormat)) {
      return NextResponse.json({ error: `packFormat must be one of ${PACK_FORMATS.join(", ")}` }, { status: 400 });
    }
    if (!PRODUCT_CATEGORIES.includes(resolvedCategory)) {
      return NextResponse.json({ error: `category must be one of ${PRODUCT_CATEGORIES.join(", ")}` }, { status: 400 });
    }

    const accessToken = randomBytes(24).toString("hex");
    const skuCode = `SELF-${accessToken.slice(0, 8).toUpperCase()}`;

    const { data: order, error: orderError } = await db
      .from("label_orders")
      .insert({
        customer_name: customerName,
        company_name: companyName,
        customer_email: customerEmail,
        sku_code: skuCode,
        product_name: productName,
        pack_format: resolvedPackFormat,
        category: resolvedCategory,
        access_token: accessToken,
        revision_limit: PUBLIC_REVISION_LIMIT,
        created_by: null,
        source: "customer",
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message ?? "Failed to create your label workspace." }, { status: 500 });
    }

    const { error: contentError } = await db.from("label_regulatory_content").insert({
      label_order_id: order.id,
      ...regulatoryInsert,
    });
    if (contentError) {
      return NextResponse.json({ error: contentError.message }, { status: 500 });
    }

    await logAudit(order.id, "customer", "order_created_public", {
      customer_email: customerEmail,
      catalog_product_id: catalogProductId || null,
      category: resolvedCategory,
    });

    return NextResponse.json({ accessToken });
  } catch (err) {
    return apiCatch(err);
  }
}
