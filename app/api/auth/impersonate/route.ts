import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 86400,
}

const SHORT_COOKIE_OPTIONS = { ...COOKIE_OPTIONS, maxAge: 3600 }

// POST /api/auth/impersonate
// Body: { user_id: number }
// Calls Xano /auth/impersonate (admin-only). On success:
//  - stash the current admin authToken under `adminAuthToken`
//  - replace `authToken` with the impersonation token (1h expiry)
export async function POST(request: Request) {
  const adminToken = await getAuthToken()
  if (!adminToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { user_id } = (await request.json()) as { user_id?: number }
  if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 })

  const xanoRes = await fetch(`${process.env.XANO_API_URL}/auth/impersonate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ user_id }),
  })
  const data = (await xanoRes.json().catch(() => ({}))) as {
    authToken?: string
    user?: { id: number; name: string; email: string }
    error?: string
    message?: string
  }
  if (!xanoRes.ok || !data.authToken) {
    return NextResponse.json(
      { error: data.error ?? data.message ?? "Failed to impersonate" },
      { status: xanoRes.status === 200 ? 400 : xanoRes.status },
    )
  }

  const response = NextResponse.json({ success: true, user: data.user })
  response.cookies.set("adminAuthToken", adminToken, COOKIE_OPTIONS)
  response.cookies.set("authToken", data.authToken, SHORT_COOKIE_OPTIONS)
  return response
}
