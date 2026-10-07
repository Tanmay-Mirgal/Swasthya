"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { getSelectedLanguage } from "@/lib/i18n/languages";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: { translate?: { TranslateElement: new (opts: Record<string, unknown>, id: string) => unknown } };
  }
}

let domPatched = false;

/** The widget does not always act on the cookie by itself; drive its hidden language picker explicitly. */
function applyLanguage(lang: string, attempts = 40) {
  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (!combo) {
    if (attempts > 0) window.setTimeout(() => applyLanguage(lang, attempts - 1), 250);
    return;
  }
  if (combo.value === lang) return;
  combo.value = lang;
  combo.dispatchEvent(new Event("change"));
}

/**
 * Google's translator rewrites text nodes in place, which makes React throw on later removeChild /
 * insertBefore calls. Make those calls tolerant of nodes that were moved out from under React.
 */
function patchDomForTranslation() {
  if (domPatched || typeof Node === "undefined") return;
  domPatched = true;
  const origRemove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return origRemove.call(this, child) as T;
  };
  const origInsert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return node;
    return origInsert.call(this, node, ref) as T;
  };
}

/**
 * Loads the Google Website Translator only when a non-English language is selected, so English users
 * never contact Google. The visible control is our own LanguageSwitcher; this renders the hidden engine.
 */
export default function GoogleTranslate() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const lang = getSelectedLanguage();
    if (lang === "en") return;
    patchDomForTranslation();
    window.googleTranslateElementInit = () => {
      const T = window.google?.translate?.TranslateElement;
      if (!T) return;
      new T({ pageLanguage: "en", includedLanguages: "en,hi,mr", autoDisplay: false }, "google_translate_element");
      applyLanguage(lang);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must read the cookie after mount
    setActive(true);
  }, []);

  return (
    <>
      <div id="google_translate_element" aria-hidden="true" className="hidden" />
      {active && (
        <Script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" strategy="afterInteractive" />
      )}
    </>
  );
}
