import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { AdminUsersClient } from "./users-client"

export default async function AdminUsersPage() {
  const me = await getCurrentUser()
  if (!me) redirect("/login")
  if (!me.is_admin) redirect("/dashboard")
  return <AdminUsersClient />
}
