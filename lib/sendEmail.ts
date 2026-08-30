import nodemailer from "nodemailer";

// The only outbound-email path in this app — sends via Gmail's SMTP using
// the same mailbox that already reads design@esilkroute.com.lk (Google
// Workspace), authenticated with an App Password rather than the account's
// real login password (Google only issues these once 2-Step Verification
// is on, and they can be revoked independently of the main password).
// Requires SMTP_EMAIL/SMTP_APP_PASSWORD in the environment; throws a clear
// error instead of silently no-opping if either is missing, so a caller's
// catch block can surface "email isn't configured yet" rather than
// pretending to succeed.
export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<void> {
  const user = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Email sending isn't configured yet (missing SMTP_EMAIL/SMTP_APP_PASSWORD).");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({ from: user, to: opts.to, subject: opts.subject, text: opts.text });
  } catch (err) {
    throw new Error(`Failed to send email: ${err instanceof Error ? err.message : String(err)}`);
  }
}
