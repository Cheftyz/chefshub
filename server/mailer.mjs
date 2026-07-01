// Sends the password-reset one-time code by email.
//
// If SMTP settings are provided via environment variables, real email is sent
// with nodemailer. Otherwise it falls back to printing the code to the server
// console so the reset flow is fully testable without an email account.
//
// To send real emails set (e.g. a Gmail App Password, or any SMTP provider):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
import nodemailer from "nodemailer";

let transport = null;
const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

if (configured) {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export const mailerConfigured = configured;

export async function sendResetCode(email, code) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "MB Chatters <no-reply@chefshub.local>";
  const subject = "Your MB Chatters password reset code";
  const text = `Your MB Chatters one-time password reset code is: ${code}\n\nIt expires in 15 minutes. If you didn't request this, ignore this email.`;

  if (!transport) {
    console.log("\n========================================");
    console.log(`[MB Chatters] Password reset code for ${email}: ${code}`);
    console.log("(No SMTP configured — showing the code here. Set SMTP_* env vars to email it.)");
    console.log("========================================\n");
    return { delivered: "console" };
  }

  await transport.sendMail({ from, to: email, subject, text });
  return { delivered: "email" };
}
