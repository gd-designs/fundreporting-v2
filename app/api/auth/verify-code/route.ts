import { NextResponse } from "next/server"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 86400,
}

// POST /api/auth/verify-code
// Body: { email: string, code: string }
// On success without 2FA: sets the authToken cookie.
// If the user has 2FA enabled, returns { requires2FA: true, challengeToken } instead.
export async function POST(request: Request) {
  const { email, code } = (await request.json()) as { email?: string; code?: string }
  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required" }, { status: 400 })
  }

  const res = await fetch(`${process.env.XANO_API_URL}/auth/verify_code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    authToken?: string
    requires_2fa?: boolean
    challenge_token?: string
    error?: string
    message?: string
    new_user?: boolean
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? data.message ?? "Invalid or expired code" },
      { status: res.status },
    )
  }

  if (data.requires_2fa && data.challenge_token) {
    return NextResponse.json({ requires2FA: true, challengeToken: data.challenge_token })
  }

  if (!data.authToken) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 })
  }

  const response = NextResponse.json({ success: true, newUser: !!data.new_user })
  response.cookies.set("authToken", data.authToken, COOKIE_OPTIONS)
  return response
}
