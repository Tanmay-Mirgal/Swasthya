"use client";

import { useSyncExternalStore } from "react";
import { getSelectedLanguage, subscribeLanguage, type LanguageCode } from "./languages";

const server = (): LanguageCode => "en";

/**
 * The language the person chose, kept in step with `changeLanguage`. The choice lives in a cookie the server cannot
 * see, so the server render (and hydration) says English and the real value is read straight after.
 */
export function useSelectedLanguage(): LanguageCode {
  return useSyncExternalStore(subscribeLanguage, getSelectedLanguage, server);
}
