import { redirect } from "next/navigation";

// Sign-in and sign-up are one combined flow (email code, account created on
// first verification), so there is a single entry point.
export default function SignUpPage() {
  redirect("/sign-in");
}
