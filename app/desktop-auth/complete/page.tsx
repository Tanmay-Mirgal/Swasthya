"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/react";
import AuthFrame from "@/components/auth/AuthFrame";
import { Notice } from "@/components/ui";

/**
 * Loaded by the desktop shell after the browser hands back a one-time code (in the URL fragment, so
 * it never reaches a server log). Trades it, with the PKCE verifier, for a Clerk ticket and signs in.
 */
export default function DesktopAuthComplete() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signIn || started.current) return;
    started.current = true;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = hash.get("code");
    const verifier = hash.get("verifier");
    // Remove the secrets from the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);

    (async () => {
      try {
        if (!code || !verifier) throw new Error("This sign-in link isn’t valid. Start again from the app.");
        const res = await fetch("/api/desktop/auth/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, verifier }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "We couldn’t finish signing in.");

        const attempt = await signIn.ticket({ ticket: json.data.ticket });
        if (attempt?.error) throw new Error("We couldn’t finish signing in. Please try again.");
        const finalized = await signIn.finalize({ navigate: () => router.replace("/") });
        if (finalized?.error) throw new Error("We couldn’t finish signing in. Please try again.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "We couldn’t finish signing in.");
      }
    })();
  }, [signIn, router]);

  return (
    <AuthFrame heading="Almost there." body="Finishing your sign-in.">
      <div className="w-full max-w-sm">
        {error ? (
          <Notice tone="danger" title={error}>
            <Link href="/sign-in" className="font-semibold underline underline-offset-2">Back to sign in</Link>
          </Notice>
        ) : (
          <p role="status" className="text-sm text-slate-700">Signing you in…</p>
        )}
      </div>
    </AuthFrame>
  );
}
