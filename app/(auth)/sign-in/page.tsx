"use client";

import { SignIn } from "@clerk/react";
import AuthFrame from "@/components/auth/AuthFrame";
import { clerkAppearance } from "@/components/auth/clerkAppearance";

export default function SignInPage() {
  return (
    <AuthFrame heading="Welcome back." body="Pick up your exercises where you left off.">
      <SignIn routing="hash" appearance={clerkAppearance} />
    </AuthFrame>
  );
}
