import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { apiCatch } from "@/lib/apiError";

const SUPPORTED_LANGUAGES = ["Sinhala", "Tamil"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// A second, much narrower AI use than generate-description/route.ts: that
// one drafts new wording from scratch, this one only ever converts the
// customer's OWN already-typed text into another script — meaning must
// stay exactly the same, nothing added or dropped, so it doesn't reopen
// the "never invented for you" boundary those routes were built around.
// Returned as a draft for the customer to review inside the canvas editor
// before it's saved via the normal marketing/regulatory routes.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved and locked." }, { status: 409 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Translation isn't configured yet." }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const language = body?.language;
    if (!text) return NextResponse.json({ error: "Nothing to translate." }, { status: 400 });
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json({ error: `language must be one of ${SUPPORTED_LANGUAGES.join(", ")}` }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Translate the following product label text into ${language as SupportedLanguage}.

Text:
"""
${text}
"""

Rules:
- Translate faithfully — do not add, remove, soften, or exaggerate any claim, fact, or number.
- Keep numbers, units, and product/brand names as-is unless a natural localized form is standard.
- Match the register of the source (a heading stays short, a sentence stays a sentence).
- Output only the translated text in ${language} script, nothing else — no notes, no quotes, no romanization.`,
        },
      ],
    });

    const translation = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!translation) return NextResponse.json({ error: "Translation came back empty. Try again." }, { status: 502 });

    return NextResponse.json({ translation });
  } catch (err) {
    return apiCatch(err);
  }
}
