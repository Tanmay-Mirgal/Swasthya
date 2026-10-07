"use client";

import { SignUp } from "@clerk/react";
import AuthFrame from "@/components/auth/AuthFrame";
import { clerkAppearance } from "@/components/auth/clerkAppearance";
import { DesktopLoginButton, desktopClerkAppearance, useIsDesktop } from "@/components/auth/DesktopLogin";

export default function SignUpPage() {
  const desktop = useIsDesktop();
  return (
    <AuthFrame heading="Create your Swasthya account." body="Patients get a prescribed exercise sheet and camera feedback. Physiotherapists get a view of every session.">
      <div className="flex flex-col items-center gap-4">
        <SignUp routing="hash" appearance={desktop ? desktopClerkAppearance : clerkAppearance} />
        {desktop && <DesktopLoginButton />}
      </div>
    </AuthFrame>
  );
}
