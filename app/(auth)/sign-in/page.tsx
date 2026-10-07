"use client";

import { SignIn } from "@clerk/react";
import AuthFrame from "@/components/auth/AuthFrame";
import { clerkAppearance } from "@/components/auth/clerkAppearance";
import { DesktopLoginButton, desktopClerkAppearance, useIsDesktop } from "@/components/auth/DesktopLogin";

export default function SignInPage() {
  const desktop = useIsDesktop();
  return (
    <AuthFrame heading="Welcome back." body="Pick up your exercises where you left off.">
      <div className="flex flex-col items-center gap-4">
        <SignIn routing="hash" appearance={desktop ? desktopClerkAppearance : clerkAppearance} />
        {desktop && <DesktopLoginButton />}
      </div>
    </AuthFrame>
  );
}
