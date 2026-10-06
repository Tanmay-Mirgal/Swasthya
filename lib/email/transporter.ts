/**
 * lib/email/transporter.ts
 *
 * The single Nodemailer transport. Server-only: it reads SMTP credentials from the
 * environment and must never be imported from a client component.
 *
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM
 *
 * For the existing Gmail setup, GOOGLE_APP_GMAIL / GOOGLE_APP_PASSWORD are accepted as
 * a fallback (smtp.gmail.com). With nothing configured, sending is skipped (and logged
 * in development) instead of throwing, so a missing mail setup never breaks a request.
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailResult = { ok: true; id: string } | { ok: false; skipped: boolean; error: string };

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export function readSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const user = env.SMTP_USER || env.GOOGLE_APP_GMAIL;
  const pass = env.SMTP_PASSWORD || env.GOOGLE_APP_PASSWORD;
  if (!user || !pass) return null;
  const host = env.SMTP_HOST || (env.GOOGLE_APP_GMAIL ? "smtp.gmail.com" : "");
  if (!host) return null;
  const port = Number(env.SMTP_PORT) || 465;
  return { host, port, user, pass, from: env.EMAIL_FROM || `Swasthya <${user}>` };
}

const globalForMail = globalThis as unknown as { __mailTransport?: { key: string; transport: Transporter } };

function getTransport(cfg: SmtpConfig): Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (globalForMail.__mailTransport?.key !== key) {
    globalForMail.__mailTransport = {
      key,
      transport: nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        auth: { user: cfg.user, pass: cfg.pass },
      }),
    };
  }
  return globalForMail.__mailTransport.transport;
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const cfg = readSmtpConfig();
  if (!cfg) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email] SMTP not configured; skipped "${message.subject}" to ${message.to}`);
    }
    return { ok: false, skipped: true, error: "Email is not configured." };
  }
  try {
    const info = await getTransport(cfg).sendMail({
      from: cfg.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    // Log the cause server-side; callers only get a safe string.
    console.error("[email] send failed:", err);
    return { ok: false, skipped: false, error: "The email could not be sent." };
  }
}
