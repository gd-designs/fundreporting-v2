import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"
import { generateRecoveryCodes, verifyTotpCode } from "@/lib/totp"

// POST /api/auth/2fa/confirm
// Body: { code: string }
// Verifies the TOTP code against the secret stored during /setup, then enables 2FA
// and returns one-time recovery codes for the user to copy.
export async function POST(request: Request) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { code } = (await request.json()) as { code?: string }
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 })

  const secretRes = await fetch(`${process.env.XANO_API_URL}/auth/2fa/get_secret`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!secretRes.ok) return NextResponse.json({ error: "No pending secret" }, { status: 400 })
  const { totp_secret } = (await secretRes.json()) as { totp_secret?: string }
  if (!totp_secret) return NextResponse.json({ error: "No pending secret" }, { status: 400 })

  if (!verifyTotpCode(totp_secret, code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
  }

  const recoveryCodes = generateRecoveryCodes()

  const enableRes = await fetch(`${process.env.XANO_API_URL}/auth/2fa/enable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recovery_codes: recoveryCodes }),
  })
  if (!enableRes.ok) {
    const detail = await enableRes.text().catch(() => "")
    console.error("[2fa/confirm] enable failed:", enableRes.status, detail)
    return NextResponse.json({ error: "Failed to enable 2FA" }, { status: 500 })
  }

  return NextResponse.json({ success: true, recoveryCodes })
}
