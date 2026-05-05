import { redirect } from "next/navigation"

// Passwordless flow auto-creates a user on first verify, so /signup just routes
// to the same email-code login page.
export default function SignupPage() {
  redirect("/login")
}
