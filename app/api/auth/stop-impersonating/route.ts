import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 86400,
}

// POST /api/auth/stop-impersonating
// Restores the stashed adminAuthToken back to authToken and clears adminAuthToken.
export async function POST() {
  const jar = await cookies()
  const admin = jar.get("adminAuthToken")?.value
  if (!admin) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set("authToken", admin, COOKIE_OPTIONS)
  response.cookies.set("adminAuthToken", "", { ...COOKIE_OPTIONS, maxAge: 0 })
  return response
}
