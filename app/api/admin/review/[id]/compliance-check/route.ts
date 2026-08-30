import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { currentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin, storageBucket } from "@/lib/supabaseServer";
import { CATEGORY_LABELS, CategoryPanelTemplate, LabelOrder, RegulatoryContent } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

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

    const [{ data: regulatory }, { data: panel }, { data: regDocs }] = await Promise.all([
      db.from("label_regulatory_content").select("*").eq("label_order_id", o.id).maybeSingle(),
      db.from("category_panel_templates").select("*").eq("category", o.category).maybeSingle(),
      db.from("label_regulation_documents").select("storage_path, file_name").order("created_at", { ascending: false }),
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
        return v ? `- ${f.label}: ${v}` : null;
      })
      .filter((line): line is string => line !== null)
      .join("\n");

    const labelContent = `Product name: ${o.display_name || o.product_name}
Tagline: ${o.marketing_tagline || "—"}
Category: ${CATEGORY_LABELS[o.category]}
Pack format: ${o.pack_format}
SKU: ${o.sku_code}

Ingredients: ${reg?.ingredients || "—"}
Claims: ${reg?.claims || "—"}
Description: ${reg?.statutory_marks || "—"}

${panelTemplate?.panel_style === "blank" ? "" : `${panelTemplate?.display_label ?? "Nutrition"} panel:\n${nutritionLines || "- (none entered)"}\n`}
Batch code: ${reg?.batch_code || "—"}
Manufacture date: ${reg?.manufacture_date || "—"}
Expiry date: ${reg?.expiry_date || "—"}`;

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

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            ...docBlocks,
            {
              type: "text",
              text: `The attached document(s) are the current official label regulations. Check the label content below against them.

${labelContent}

Rules:
- List ONLY the specific, concrete items that need to change for this label to comply with the attached regulation(s) — short bullet points, one line each (e.g. "Add allergen statement", "Net weight must be in metric units").
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
