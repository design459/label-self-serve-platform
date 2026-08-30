// The only outbound-email path in this app — sends via Resend's HTTP API.
// Requires RESEND_API_KEY in the environment; throws a clear error instead
// of silently no-opping if it's missing, so a caller's catch block can
// surface "email isn't configured yet" rather than pretending to succeed.
// RESEND_FROM_EMAIL is optional — defaults to Resend's shared sandbox
// sender, which works immediately with no domain verification since these
// emails only ever go to one internal staff address, never to customers.
export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email sending isn't configured yet (missing RESEND_API_KEY).");

  const from = process.env.RESEND_FROM_EMAIL || "Label Platform <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to send email (${res.status}): ${detail}`);
  }
}
