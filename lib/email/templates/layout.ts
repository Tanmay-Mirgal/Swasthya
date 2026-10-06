/**
 * Shared email layout. Inline styles only (email clients ignore stylesheets), no remote
 * images, system fonts. Every interpolated value goes through `esc`.
 */

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function appUrl(path = "/"): string {
  const base =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

export interface EmailParts {
  preheader: string;
  heading: string;
  /** Paragraphs of plain text (escaped for HTML, kept verbatim in the text part). */
  paragraphs: string[];
  /** Optional label/value rows, like the lines on an exercise sheet. */
  facts?: { label: string; value: string }[];
  cta?: { label: string; href: string };
  footnote: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

const INK = "#1a1f1d";
const PAPER = "#fbfbf8";
const CANVAS = "#f6f7f3";
const RULE = "#dde0d7";
const BRAND = "#1f6b4f";
const MUTED = "#636b5f";

export function renderEmail(p: EmailParts): RenderedEmail {
  const paragraphs = p.paragraphs
    .map((t) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${INK};">${esc(t)}</p>`)
    .join("");
  const facts = p.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border-top:1px solid ${INK};">${p.facts
        .map(
          (f) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid ${RULE};font-size:14px;color:${MUTED};width:44%;">${esc(f.label)}</td><td style="padding:10px 0;border-bottom:1px solid ${RULE};font-size:15px;color:${INK};font-weight:600;">${esc(f.value)}</td></tr>`
        )
        .join("")}</table>`
    : "";
  const cta = p.cta
    ? `<p style="margin:24px 0 8px;"><a href="${esc(p.cta.href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:13px 22px;border-radius:5px;">${esc(p.cta.label)}</a></p><p style="margin:0 0 4px;font-size:13px;color:${MUTED};word-break:break-all;">Or open: ${esc(p.cta.href)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.heading)}</title></head>
<body style="margin:0;padding:0;background:${CANVAS};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(p.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${PAPER};border:1px solid ${RULE};border-radius:6px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:22px 28px 0;"><div style="font-size:18px;font-weight:700;letter-spacing:.01em;color:${BRAND};">Swasthya</div><div style="height:2px;background:${INK};margin-top:14px;"></div></td></tr>
<tr><td style="padding:22px 28px 6px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK};">${esc(p.heading)}</h1>
${paragraphs}${facts}${cta}
</td></tr>
<tr><td style="padding:18px 28px 26px;"><div style="border-top:1px solid ${RULE};padding-top:14px;font-size:12.5px;line-height:1.5;color:${MUTED};">${esc(p.footnote)}</div></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    p.heading,
    "",
    ...p.paragraphs.flatMap((t) => [t, ""]),
    ...(p.facts?.length ? [...p.facts.map((f) => `${f.label}: ${f.value}`), ""] : []),
    ...(p.cta ? [`${p.cta.label}: ${p.cta.href}`, ""] : []),
    "--",
    p.footnote,
  ].join("\n");

  return { html, text };
}

export const PATIENT_FOOTNOTE =
  "You get this because you have a rehabilitation plan on Swasthya. You can turn reminder emails off in Profile. Swasthya gives movement guidance and does not diagnose; contact your therapist about any pain or concern.";
export const THERAPIST_FOOTNOTE =
  "You get this because you are a therapist on Swasthya. Automated figures in reports come from on-device camera measurements and are not a clinical assessment.";
