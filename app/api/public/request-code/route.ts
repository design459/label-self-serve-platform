import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/sendEmail";
import { apiCatch } from "@/lib/apiError";

// Fixed — never client-controlled. This is the one place these codes ever
// go; the customer's own email is only used to tie the code to them (see
// app/api/public/orders/route.ts's verification), never as a send target.
const STAFF_EMAIL = "design@esilkroute.com.lk";
const CODE_TTL_MINUTES = 30;
const MAX_REQUESTS_PER_IP_PER_HOUR = 5;
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 5;
const MIN_FORM_FILL_MS = 3000;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-nf-client-connection-ip") || "unknown";
}

// Unauthenticated, same bot-defense posture as orders/route.ts. Generates a
// one-time code, stores it, and emails it ONLY to staff — never to the
// customer — so starting a real design workspace stays gated behind a
// human decision (see supabase/migrations/0012_access_codes.sql).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const { customerName, companyName, customerEmail, context, honeypot, renderedAt } = body;

    if (typeof honeypot === "string" && honeypot.trim() !== "") {
      return NextResponse.json({ ok: true });
    }
    if (typeof renderedAt !== "number" || Date.now() - renderedAt < MIN_FORM_FILL_MS) {
      return NextResponse.json({ ok: true });
    }

    if (!customerName || !customerEmail || !companyName) {
      return NextResponse.json({ error: "Your name, company name and email are required." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const ip = clientIp(req);
    const email = String(customerEmail).trim().toLowerCase();

    const [{ data: ipAllowed, error: ipRateError }, { data: emailAllowed, error: emailRateError }] = await Promise.all([
      db.rpc("lg_check_rate_limit", { p_bucket: "public_code_request_ip", p_identifier: ip, p_max_per_hour: MAX_REQUESTS_PER_IP_PER_HOUR }),
      db.rpc("lg_check_rate_limit", { p_bucket: "public_code_request_email", p_identifier: email, p_max_per_hour: MAX_REQUESTS_PER_EMAIL_PER_HOUR }),
    ]);
    if (ipRateError) return NextResponse.json({ error: ipRateError.message }, { status: 500 });
    if (emailRateError) return NextResponse.json({ error: emailRateError.message }, { status: 500 });
    if (!ipAllowed || !emailAllowed) {
      return NextResponse.json({ error: "Too many code requests recently. Try again in a bit." }, { status: 429 });
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await db.from("lg_access_codes").insert({
      email,
      code,
      customer_name: customerName,
      company_name: companyName,
      context: typeof context === "string" ? context.slice(0, 200) : null,
      expires_at: expiresAt,
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    try {
      await sendEmail({
        to: STAFF_EMAIL,
        subject: `Label workspace code request — ${customerName} (${companyName})`,
        text: [
          "A customer requested a code to start a label design workspace.",
          "",
          `Name: ${customerName}`,
          `Company: ${companyName}`,
          `Email: ${customerEmail}`,
          context ? `Starting point: ${context}` : null,
          "",
          `Code: ${code}`,
          "",
          `This code expires in ${CODE_TTL_MINUTES} minutes. Share it with the customer only if you want them to proceed.`,
        ]
          .filter((line): line is string => line !== null)
          .join("\n"),
      });
    } catch (emailErr) {
      return NextResponse.json(
        { error: emailErr instanceof Error ? emailErr.message : "Couldn't send the code email. Please try again." },
        { status: 500 }
      );
    }

    await logAudit(null, "customer", "access_code_requested", { customer_email: email });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiCatch(err);
  }
}
