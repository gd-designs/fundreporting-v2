import { NextResponse } from "next/server"
import { verifyTotpCode } from "@/lib/totp"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 86400,
}

// POST /api/auth/2fa/exchange
// Body: { challengeToken: string, code: string }
// Verifies the TOTP code (or recovery code) against the pending challenge,
// then completes the challenge with Xano and sets the authToken cookie.
export async function POST(request: Request) {
  const { challengeToken, code } = (await request.json()) as {
    challengeToken?: string
    code?: string
  }
  if (!challengeToken || !code) {
    return NextResponse.json({ error: "Challenge and code are required" }, { status: 400 })
  }

  // 1. Look up the pending challenge → get user_id + secret + recovery hashes.
  const pendingRes = await fetch(`${process.env.XANO_API_URL}/auth/2fa/get_pending`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_token: challengeToken }),
  })
  if (!pendingRes.ok) {
    return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 400 })
  }
  const pending = (await pendingRes.json()) as {
    totp_secret?: string
    user_id?: number
  }
  if (!pending.totp_secret || !pending.user_id) {
    return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 400 })
  }

  // 2. Verify code locally.
  const trimmed = code.trim()
  const isTotp = /^\d{6}$/.test(trimmed.replace(/\s+/g, ""))
  let verified = false
  let recoveryCode: string | null = null

  if (isTotp) {
    verified = verifyTotpCode(pending.totp_secret, trimmed)
  } else {
    recoveryCode = trimmed.toLowerCase()
  }

  if (!verified && !recoveryCode) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
  }

  // 3. Complete with Xano → mints authToken. Xano validates the recovery code if provided.
  const completeRes = await fetch(`${process.env.XANO_API_URL}/auth/2fa/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge_token: challengeToken,
      recovery_code: recoveryCode,
    }),
  })
  const completed = (await completeRes.json().catch(() => ({}))) as {
    authToken?: string
    error?: string
    message?: string
  }
  if (!completeRes.ok || !completed.authToken) {
    return NextResponse.json(
      { error: completed.error ?? completed.message ?? "Failed to complete 2FA" },
      { status: completeRes.status === 200 ? 400 : completeRes.status },
    )
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set("authToken", completed.authToken, COOKIE_OPTIONS)
  return response
}
