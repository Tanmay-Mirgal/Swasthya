import test from "node:test";
import assert from "node:assert/strict";
import { applyLanguageCookies, clearTranslateCookies, cookieDomains, getSelectedLanguage, syncTranslateCookie, type CookieEnv } from "./languages";

/** A small model of how a browser scopes cookies: host-only vs domain cookies, path, expiry, and read order. */
class Jar implements CookieEnv {
  private n = 0;
  private rows: { name: string; value: string; domain: string | null; path: string; order: number }[] = [];
  constructor(readonly hostname: string) {}

  write(cookie: string) {
    const [pair, ...attrs] = cookie.split(/;\s*/);
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const a = Object.fromEntries(attrs.map((x) => [x.split("=")[0].toLowerCase(), x.split("=")[1] ?? ""]));
    let domain: string | null = null;
    if (a.domain) {
      domain = a.domain.replace(/^\./, "");
      const sub = this.hostname === domain || this.hostname.endsWith(`.${domain}`);
      if (!sub || !domain.includes(".")) return; // rejected: not a parent of this host, or a bare top-level name
    }
    const path = a.path ?? "/";
    const expired = a["max-age"] !== undefined ? Number(a["max-age"]) <= 0 : a.expires ? Date.parse(a.expires) < Date.now() : false;
    const at = this.rows.findIndex((r) => r.name === name && r.domain === domain && r.path === path);
    if (expired) {
      if (at >= 0) this.rows.splice(at, 1);
      return;
    }
    if (at >= 0) this.rows[at].value = value;
    else this.rows.push({ name, value, domain, path, order: this.n++ });
  }

  /** Longer paths first, then oldest first: this is why a stale cookie beats a new one. */
  read() {
    return [...this.rows].sort((x, y) => y.path.length - x.path.length || x.order - y.order).map((r) => `${r.name}=${r.value}`).join("; ");
  }

  all(name: string) {
    return this.rows.filter((r) => r.name === name).map((r) => r.value);
  }
}

const GOOGLE = "googtrans";

/** What Google's script leaves behind after translating: the same value on the parent domain AND on the host. */
function afterGoogleTranslated(jar: Jar, lang: string) {
  jar.write(`${GOOGLE}=/en/${lang}; path=/; domain=.example.com`);
  jar.write(`${GOOGLE}=/en/${lang}; path=/`);
}

test("domains to clear: host-only, the host, and every parent that is not a bare top-level name", () => {
  assert.deepEqual(cookieDomains("www.example.com"), [null, "www.example.com", ".www.example.com", "example.com", ".example.com"]);
  assert.deepEqual(cookieDomains("localhost"), [null]);
  assert.deepEqual(cookieDomains("127.0.0.1"), [null]);
  assert.deepEqual(cookieDomains("example.com"), [null, "example.com", ".example.com"]);
});

test("choosing another language replaces Google's stale parent-domain cookie instead of being shadowed by it", () => {
  const jar = new Jar("www.example.com");
  applyLanguageCookies("hi", jar);
  afterGoogleTranslated(jar, "hi");
  assert.equal(getSelectedLanguage(jar), "hi");

  // The bug: switching to Marathi left `/en/hi` on `.example.com`, which was read first, so the page stayed Hindi.
  applyLanguageCookies("mr", jar);
  assert.equal(getSelectedLanguage(jar), "mr");
  assert.deepEqual(jar.all(GOOGLE), ["/en/mr"], "exactly one translate cookie, and it is the new one");
});

test("a person can go from any language to any other, in any order, any number of times", () => {
  const jar = new Jar("app.example.com");
  const order = ["hi", "mr", "en", "mr", "hi", "en", "hi"] as const;
  for (const lang of order) {
    applyLanguageCookies(lang, jar);
    jar.write(`${GOOGLE}=/en/${lang}; path=/; domain=.example.com`); // Google writes its own copy each time
    assert.equal(getSelectedLanguage(jar), lang, `after choosing ${lang}`);
  }
});

test("choosing English removes the translation everywhere", () => {
  const jar = new Jar("www.example.com");
  afterGoogleTranslated(jar, "hi");
  applyLanguageCookies("en", jar);
  assert.equal(getSelectedLanguage(jar), "en");
  assert.deepEqual(jar.all(GOOGLE), []);
});

test("an older person's choice (only Google's cookie exists) is still honoured, then made consistent", () => {
  const jar = new Jar("www.example.com");
  afterGoogleTranslated(jar, "mr");
  assert.equal(getSelectedLanguage(jar), "mr");
  assert.equal(syncTranslateCookie(jar), "mr");
  assert.deepEqual(jar.all("swasthya_lang"), ["mr"]);
  assert.deepEqual(jar.all(GOOGLE), ["/en/mr"]);
});

test("sync repairs a stale Google cookie that disagrees with the choice, before the translator reads it", () => {
  const jar = new Jar("www.example.com");
  applyLanguageCookies("mr", jar);
  jar.write(`${GOOGLE}=/en/hi; path=/; domain=.example.com`); // stale copy from an earlier visit
  assert.equal(syncTranslateCookie(jar), "mr");
  assert.deepEqual(jar.all(GOOGLE), ["/en/mr"]);
});

test("sync leaves already-consistent cookies alone (no needless rewrite)", () => {
  const jar = new Jar("www.example.com");
  applyLanguageCookies("hi", jar);
  const before = jar.read();
  syncTranslateCookie(jar);
  assert.equal(jar.read(), before);
});

test("nothing chosen means English, and unknown or tampered values are ignored", () => {
  const jar = new Jar("localhost");
  assert.equal(getSelectedLanguage(jar), "en");
  jar.write("swasthya_lang=fr; path=/");
  jar.write(`${GOOGLE}=/en/zz; path=/`);
  assert.equal(getSelectedLanguage(jar), "en");
});

test("on localhost (no parent domain) switching still works", () => {
  const jar = new Jar("localhost");
  applyLanguageCookies("hi", jar);
  applyLanguageCookies("mr", jar);
  assert.equal(getSelectedLanguage(jar), "mr");
  clearTranslateCookies(jar);
  assert.deepEqual(jar.all(GOOGLE), []);
});
