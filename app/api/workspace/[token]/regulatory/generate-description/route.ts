import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

// The one place in this app an AI drafts label-facing text — see the
// "Description" field in CategoryPanelEditor.tsx. Deliberately narrow:
// grounded only in this order's own real ingredients/claims, explicitly
// forbidden from adding health claims or dosage/warning text (those come
// from real product data or the customer directly — see
// app/api/public/orders/route.ts and regulatory/route.ts). The draft is
// returned for the customer to review and edit; nothing here is saved
// until they hit "Save regulatory details" themselves.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved and locked." }, { status: 409 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Description generation isn't configured yet." }, { status: 500 });
    }

    const db = supabaseAdmin();
    const { data: reg } = await db
      .from("label_regulatory_content")
      .select("ingredients, claims")
      .eq("label_order_id", order.id)
      .maybeSingle();

    const productName = order.display_name || order.product_name;
    const ingredients = reg?.ingredients || "not specified";
    const claims = reg?.claims || "none";

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Write a short, neutral product description (2-3 sentences, 60 words or fewer) for a dietary supplement label, suitable to print on packaging.

Product name: ${productName}
Ingredients: ${ingredients}
Certifications/claims: ${claims}

Rules:
- Base the description only on the ingredients and certifications given above.
- Do not state or imply any health benefit, medical claim, or cure that isn't already listed in the certifications above.
- Do not mention dosage, suggested use, or warnings — those appear elsewhere on the label.
- Plain, factual, brand-neutral tone. No exclamation marks, no superlatives like "best" or "amazing".
- Output only the description text, nothing else.`,
        },
      ],
    });

    const description = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return NextResponse.json({ description });
  } catch (err) {
    return apiCatch(err);
  }
}
