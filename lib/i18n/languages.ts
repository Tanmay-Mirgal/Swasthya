export type LanguageCode = "en" | "hi" | "mr";

export interface LanguageInfo {
  code: LanguageCode;
  label: string;
  native: string;
  /** BCP-47 tag handed to the speech engine so the coach is voiced in this language. */
  speech: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", label: "English", native: "English", speech: "en-IN" },
  { code: "hi", label: "Hindi", native: "हिन्दी", speech: "hi-IN" },
  { code: "mr", label: "Marathi", native: "मराठी", speech: "mr-IN" },
];

export const languageInfo = (code: LanguageCode): LanguageInfo => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

/** Google's own cookie (`/en/hi`). It is written by their script, on whichever domain scope it likes. */
const TRANSLATE_COOKIE = "googtrans";
/** Ours. Only this app writes it, always host-only, so it can never be shadowed by a stale copy. */
const CHOICE_COOKIE = "swasthya_lang";
const YEAR = 31536000;
const EXPIRED = "expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";

/** Where cookies are read and written. Injectable so the rules below can be tested without a browser. */
export interface CookieEnv {
  read(): string;
  write(cookie: string): void;
  hostname: string;
}

function browserEnv(): CookieEnv {
  return { read: () => document.cookie, write: (c) => void (document.cookie = c), hostname: window.location.hostname };
}

const isLanguage = (v: unknown): v is LanguageCode => LANGUAGES.some((l) => l.code === v);

/**
 * Every `domain=` a cookie for this host could have been written with: host-only (null), the host itself and each
 * parent that is not a bare top-level name. Google's script writes `googtrans` on the parent domain
 * (`.example.com`) as well as on the host, so clearing only the host leaves a stale copy that wins on the next read.
 */
export function cookieDomains(hostname: string): (string | null)[] {
  const out: (string | null)[] = [null];
  const labels = hostname.split(".").filter(Boolean);
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
  if (isIp || labels.length < 2) return out;
  for (let i = 0; i <= labels.length - 2; i++) {
    const suffix = labels.slice(i).join(".");
    out.push(suffix, `.${suffix}`);
  }
  return out;
}

function valuesOf(cookies: string, name: string): string[] {
  const found: string[] = [];
  for (const part of cookies.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) found.push(decodeURIComponent(part.slice(eq + 1)));
  }
  return found;
}

const translateTarget = (value: string): LanguageCode | null => {
  const target = value.split("/")[2];
  return isLanguage(target) ? target : null;
};

/** Removes `googtrans` from every scope it may live in. */
export function clearTranslateCookies(env: CookieEnv = browserEnv()): void {
  for (const domain of cookieDomains(env.hostname)) {
    env.write(`${TRANSLATE_COOKIE}=; ${EXPIRED}; path=/${domain ? `; domain=${domain}` : ""}`);
  }
}

/**
 * The language the person chose. Our own cookie decides; Google's is only a fallback for people who chose before
 * this cookie existed (then the first value, which is the one Google itself would act on).
 */
export function getSelectedLanguage(env?: CookieEnv): LanguageCode {
  if (!env && typeof document === "undefined") return "en";
  const e = env ?? browserEnv();
  const cookies = e.read();
  const own = valuesOf(cookies, CHOICE_COOKIE)[0];
  if (isLanguage(own)) return own;
  for (const v of valuesOf(cookies, TRANSLATE_COOKIE)) {
    const t = translateTarget(v);
    if (t) return t;
  }
  return "en";
}

/** Writes the choice so that exactly one value exists everywhere: ours, and Google's for non-English. */
export function applyLanguageCookies(code: LanguageCode, env: CookieEnv = browserEnv()): void {
  clearTranslateCookies(env);
  env.write(`${CHOICE_COOKIE}=${code}; path=/; max-age=${YEAR}; SameSite=Lax`);
  if (code !== "en") env.write(`${TRANSLATE_COOKIE}=/en/${code}; path=/; max-age=${YEAR}; SameSite=Lax`);
}

/**
 * Makes Google's cookie agree with the choice before its script reads it. Without this, a stale `/en/hi` left on
 * another domain scope overrides a newer choice and the switcher snaps back to the first language.
 */
export function syncTranslateCookie(env?: CookieEnv): LanguageCode {
  if (!env && typeof document === "undefined") return "en";
  const e = env ?? browserEnv();
  const lang = getSelectedLanguage(e);
  const expected = lang === "en" ? [] : [`/en/${lang}`];
  const actual = valuesOf(e.read(), TRANSLATE_COOKIE);
  const agrees = lang === "en" ? actual.length === 0 : actual.every((v) => v === expected[0]);
  const ownSaved = valuesOf(e.read(), CHOICE_COOKIE)[0] === lang;
  if (!agrees || !ownSaved) applyLanguageCookies(lang, e);
  return lang;
}

/** Persist the choice, then reload so the translator applies it to the whole page. */
export function setSelectedLanguage(code: LanguageCode) {
  applyLanguageCookies(code);
  window.location.reload();
}

const listeners = new Set<() => void>();

/** Called whenever `changeLanguage` runs, so components that speak or show coach text can follow the choice at once. */
export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * Persist the choice WITHOUT reloading, for screens that cannot be interrupted (the live exercise: a reload would stop
 * the camera and lose the reps of the current chunk). The coach's words and voice change immediately; the translator
 * applies the choice to the rest of the page the next time a page is loaded.
 */
export function changeLanguage(code: LanguageCode, env?: CookieEnv): void {
  if (!env && typeof document === "undefined") return;
  applyLanguageCookies(code, env);
  listeners.forEach((l) => l());
}
