import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

/**
 * POST /api/resolve-investor-user
 * Find or create a platform user by email, returning their numeric ID.
 * Used when creating cap_table_shareholder records outside the bypass flow.
 */
export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { email, name }: { email?: string; name?: string } = await req.json()
  if (!email?.trim()) return NextResponse.json({ userId: null })

  const base = process.env.PLATFORM_API_URL!
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // Check if user already exists
  const checkRes = await fetch(`${base}/user/check-email`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ email: email.trim() }),
  })
  if (checkRes.ok) {
    const data: { exists: boolean; user?: { id: number } } = await checkRes.json()
    if (data.exists && data.user?.id != null) {
      return NextResponse.json({ userId: data.user.id })
    }
  }

  // Create passwordless user
  const createRes = await fetch(`${base}/user`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: name?.trim() ?? email.trim(), email: email.trim() }),
  })
  if (!createRes.ok) return NextResponse.json({ userId: null })
  const newUser: { id: number } = await createRes.json()
  return NextResponse.json({ userId: newUser.id })
}
