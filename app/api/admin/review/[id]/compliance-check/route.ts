import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { currentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin, storageBucket, signedUrlFor } from "@/lib/supabaseServer";
import { CATEGORY_LABELS, CategoryPanelTemplate, LabelOrder, RegulatoryContent } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

const MISSING = "(not provided — blank on the label)";

// "Quality Assurance (QA) Review" on the review page — staff-triggered,
// never automatic. Reads the label's own real content (never re-typed or
// summarized by hand) plus every PDF currently in
// label_regulation_documents (the Management Dashboard's "Label
// Regulations" library — see app/api/admin/regulations/route.ts) and asks
// Claude to list only the concrete changes needed for compliance. This is
// advisory input for the human reviewer, not a decision: it never writes
// to compliance_reviews or label_orders.status — only Approve/Reject
// (ReviewActions.tsx / app/api/admin/review/[id]/route.ts) does that.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const staff = await currentStaff();
    if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "QA review isn't configured yet." }, { status: 500 });
    }

    const db = supabaseAdmin();
    const { data: order } = await db.from("label_orders").select("*").eq("id", params.id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const o = order as LabelOrder;

    const [{ data: regulatory }, { data: panel }, { data: regDocs }, { data: design }] = await Promise.all([
      db.from("label_regulatory_content").select("*").eq("label_order_id", o.id).maybeSingle(),
      db.from("category_panel_templates").select("*").eq("category", o.category).maybeSingle(),
      db.from("label_regulation_documents").select("storage_path, file_name").order("created_at", { ascending: false }),
      db
        .from("label_designs")
        .select("*")
        .eq("label_order_id", o.id)
        .eq("is_submitted", true)
        .order("revision_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!regDocs || regDocs.length === 0) {
      return NextResponse.json(
        { error: "No regulation documents uploaded yet — add at least one PDF in the Management Dashboard first." },
        { status: 400 }
      );
    }

    const reg = regulatory as RegulatoryContent | null;
    const panelTemplate = panel as CategoryPanelTemplate | null;

    const nutritionLines = (panelTemplate?.field_schema ?? [])
      .map((f) => {
        const v = reg?.nutrition_panel?.[f.key];
        return `- ${f.label}: ${v || MISSING}`;
      })
      .join("\n");

    // Blank fields render as an explicit "(not provided...)" string rather
    // than an em dash or empty string — a blank/near-invisible value here
    // was exactly how the first version of this check let a genuinely
    // empty batch code slip through as "compliant": Claude read "—" as a
    // placeholder character, not as "this is missing."
    const labelContent = `Product name: ${o.display_name || o.product_name}
Tagline: ${o.marketing_tagline || MISSING}
Category: ${CATEGORY_LABELS[o.category]}
Pack format: ${o.pack_format}
SKU: ${o.sku_code}

Ingredients: ${reg?.ingredients || MISSING}
Claims: ${reg?.claims || MISSING}
Description: ${reg?.statutory_marks || MISSING}

${panelTemplate?.panel_style === "blank" ? "" : `${panelTemplate?.display_label ?? "Nutrition"} panel:\n${nutritionLines || `- ${MISSING}`}\n`}
Batch code: ${reg?.batch_code || MISSING}
Manufacture date: ${reg?.manufacture_date || MISSING}
Expiry date: ${reg?.expiry_date || MISSING}`;

    // Download every regulation PDF as base64 and hand them to Claude as
    // real document content blocks (not pre-extracted text) — the model
    // reads them itself, same fidelity as a human reviewer opening the PDF.
    const docBlocks = await Promise.all(
      (regDocs as { storage_path: string; file_name: string }[]).map(async (d) => {
        const { data, error } = await db.storage.from(storageBucket()).download(d.storage_path);
        if (error || !data) throw new Error(`Failed to load regulation document "${d.file_name}": ${error?.message ?? "unknown error"}`);
        const buffer = Buffer.from(await data.arrayBuffer());
        return {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: buffer.toString("base64") },
        };
      })
    );

    // Also hand over the actual rendered proof image(s) — checking only
    // the underlying text fields above misses anything that's a property
    // of the LAYOUT (legibility, font size, what's actually visible and
    // where), which a regulation can absolutely require. This is what a
    // human reviewer would look at first.
    const proofPaths: string[] = Array.isArray(design?.proof_storage_paths)
      ? design.proof_storage_paths
      : design?.proof_storage_path
      ? [design.proof_storage_path]
      : [];
    const proofUrls = (await Promise.all(proofPaths.map((p) => signedUrlFor(p)))).filter((u): u is string => u !== null);
    const imageBlocks = proofUrls.map((url) => ({ type: "image" as const, source: { type: "url" as const, url } }));

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            ...docBlocks,
            ...imageBlocks,
            {
              type: "text",
              text: `The attached PDF(s) are the current official label regulations. The attached image(s), if any, are the actual rendered label proof — review those the way a human QA reviewer would (layout, legibility, what's actually printed and where), not just the text fields below. The text fields are the same data behind that rendered label:

${labelContent}

Rules:
- Be thorough: check every mandatory declaration the attached regulation(s) require (e.g. batch/lot identification, date marking, net quantity, ingredient declaration, allergen statement, manufacturer/importer/distributor name and address, country of origin, language requirements, nutrition/supplement panel format) — not just the obvious ones.
- A field marked "${MISSING}" above, or empty/unreadable in the rendered image, is NOT compliant if the regulation requires that information — flag it.
- List ONLY the specific, concrete items that need to change — short bullet points, one line each (e.g. "Add allergen statement", "Batch code is blank — required for traceability", "Net weight must be in metric units").
- Do not restate what's already correct or compliant.
- Do not invent a requirement that isn't actually in the attached document(s).
- If nothing needs to change, respond with exactly: No compliance issues found.
- Output only the bullet list (or that exact sentence), nothing else — no preamble, no summary.`,
            },
          ],
        },
      ],
    });

    const result = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return NextResponse.json({ result: result || "No compliance issues found." });
  } catch (err) {
    return apiCatch(err);
  }
}
