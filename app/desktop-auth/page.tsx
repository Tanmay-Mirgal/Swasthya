"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SignIn, useAuth, useUser } from "@clerk/react";
import AuthFrame from "@/components/auth/AuthFrame";
import { clerkAppearance } from "@/components/auth/clerkAppearance";
import { Button, Notice } from "@/components/ui";

/**
 * Opened by the desktop app in the system browser. Social login providers refuse embedded windows,
 * so the user signs in here with the normal web flow and then hands the session back to the app.
 */
function DesktopAuth() {
  const params = useSearchParams();
  const state = params.get("state") || "";
  const challenge = params.get("challenge") || "";
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handedOver, setHandedOver] = useState(false);

  const valid = /^[A-Za-z0-9_-]{16,64}$/.test(state) && /^[A-Za-z0-9_-]{43}$/.test(challenge);

  const handOver = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/desktop/auth/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ challenge }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "We couldn’t start desktop sign-in.");
        return;
      }
      setHandedOver(true);
      window.location.href = `swasthya://auth?code=${encodeURIComponent(json.data.code)}&state=${encodeURIComponent(state)}`;
    } catch {
      setError("We couldn’t reach Swasthya. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame heading="Sign in to the desktop app." body="Use your browser, then come straight back to Swasthya.">
      <div className="w-full max-w-sm space-y-4">
        {!valid ? (
          <Notice tone="warning" title="Open this page from the Swasthya desktop app">
            Choose “Continue in your browser” on the desktop app’s sign-in screen.
          </Notice>
        ) : !isLoaded ? (
          <p role="status" className="text-sm text-slate-600">Loading…</p>
        ) : !isSignedIn ? (
          <SignIn routing="hash" withSignUp forceRedirectUrl={typeof window === "undefined" ? undefined : window.location.href} appearance={clerkAppearance} />
        ) : handedOver ? (
          <Notice tone="success" title="Return to the Swasthya app">
            If it didn’t open, click the button again. You can close this tab afterwards.
            <div className="mt-3"><Button variant="outline" onClick={handOver} disabled={busy}>Open Swasthya</Button></div>
          </Notice>
        ) : (
          <div className="space-y-4 rounded-xl border border-slate-300 bg-white p-6">
            <h1 className="text-lg font-bold text-slate-900">Continue to Swasthya Desktop</h1>
            <p className="text-sm text-slate-700">
              Sign in the desktop app as <span className="font-semibold">{user?.primaryEmailAddress?.emailAddress || user?.fullName || "this account"}</span>?
              Only continue if you just chose this on the desktop app.
            </p>
            {error && <Notice tone="danger" title={error} />}
            <Button onClick={handOver} disabled={busy} className="w-full">{busy ? "Opening…" : "Continue to the app"}</Button>
          </div>
        )}
      </div>
    </AuthFrame>
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense fallback={null}>
      <DesktopAuth />
    </Suspense>
  );
}
