"use client";

import { SignUp } from "@clerk/react";
import AuthFrame from "@/components/auth/AuthFrame";
import { clerkAppearance } from "@/components/auth/clerkAppearance";

export default function SignUpPage() {
  return (
    <AuthFrame heading="Create your Swasthya account." body="Patients get a prescribed exercise sheet and camera feedback. Physiotherapists get a view of every session.">
      <SignUp routing="hash" appearance={clerkAppearance} />
    </AuthFrame>
  );
}
