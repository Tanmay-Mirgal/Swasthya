import { redirect } from "next/navigation";

// The old local mock form bypassed real authentication; sign-in is handled by Clerk.
export default function LoginPage() {
  redirect("/sign-in");
}
