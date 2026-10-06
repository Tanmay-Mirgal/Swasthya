import { redirect } from "next/navigation";

// The old local mock form bypassed real authentication; sign-up is handled by Clerk.
export default function SignupPage() {
  redirect("/sign-up");
}
