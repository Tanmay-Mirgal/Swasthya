"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";
import { clerkAppearance } from "./clerkAppearance";

/** True only inside the Swasthya desktop app (known after mount, so the server HTML is unchanged). */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the bridge only exists in the browser
    setDesktop(Boolean(window.SwasthyaDesktop?.isDesktop));
  }, []);
  return desktop;
}

/** Social providers refuse embedded windows, so inside the desktop app they are hidden here and offered in the browser. */
export const desktopClerkAppearance = {
  ...clerkAppearance,
  elements: { ...clerkAppearance.elements, socialButtons: { display: "none" }, dividerRow: { display: "none" } },
};

export function DesktopLoginButton() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">Use Google or another account</p>
      <p className="mt-1 text-sm text-slate-600">Sign in in your browser, then you’re brought straight back here.</p>
      <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => void window.SwasthyaDesktop?.startExternalLogin()}>
        <ExternalLink className="size-4" aria-hidden="true" /> Continue in your browser
      </Button>
    </div>
  );
}
