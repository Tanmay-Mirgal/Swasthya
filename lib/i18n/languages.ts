export type LanguageCode = "en" | "hi" | "mr";

export const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
];

const COOKIE = "googtrans";

/** The language Google Translate will apply, read from its own cookie (`/en/hi`). */
export function getSelectedLanguage(): LanguageCode {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  const target = match ? decodeURIComponent(match[1]).split("/")[2] : "en";
  return LANGUAGES.some((l) => l.code === target) ? (target as LanguageCode) : "en";
}

/** Persist the choice in the cookie the translator reads, then reload so it is applied to the whole page. */
export function setSelectedLanguage(code: LanguageCode) {
  const host = window.location.hostname;
  const expire = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
  // Clear on both the host and its parent domain (the translator may have written either).
  document.cookie = `${COOKIE}=; ${expire}; path=/`;
  document.cookie = `${COOKIE}=; ${expire}; path=/; domain=${host}`;
  if (code !== "en") {
    const value = `/en/${code}`;
    document.cookie = `${COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
  }
  window.location.reload();
}
