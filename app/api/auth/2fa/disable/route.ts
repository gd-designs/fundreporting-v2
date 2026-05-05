import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"
import { verifyTotpCode } from "@/lib/totp"

// POST /api/auth/2fa/disable
// Body: { code: string }
// Verifies a current TOTP code (or a recovery code) before clearing 2FA.
export async function POST(request: Request) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { code } = (await request.json()) as { code?: string }
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 })

  const secretRes = await fetch(`${process.env.XANO_API_URL}/auth/2fa/get_secret`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!secretRes.ok) return NextResponse.json({ error: "2FA not enabled" }, { status: 400 })
  const { totp_secret } = (await secretRes.json()) as { totp_secret?: string }
  if (!totp_secret) return NextResponse.json({ error: "2FA not enabled" }, { status: 400 })

  if (!verifyTotpCode(totp_secret, code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
  }

  const disableRes = await fetch(`${process.env.XANO_API_URL}/auth/2fa/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  })
  if (!disableRes.ok) {
    const detail = await disableRes.text().catch(() => "")
    console.error("[2fa/disable] disable failed:", disableRes.status, detail)
    return NextResponse.json({ error: "Failed to disable 2FA" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
