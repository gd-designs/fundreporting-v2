import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"
import { buildTotpQrDataUrl, generateTotpSecret } from "@/lib/totp"

// POST /api/auth/2fa/setup
// Generates a fresh TOTP secret, persists it on the user (totp_enabled stays false
// until /confirm), and returns the secret + QR data URL for the user to scan.
export async function POST() {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Identify the user — needed for the otpauth URI label.
  const meRes = await fetch(`${process.env.XANO_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!meRes.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const me = (await meRes.json()) as { email: string }

  const secret = generateTotpSecret()

  const saveRes = await fetch(`${process.env.XANO_API_URL}/auth/2fa/save_secret`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ totp_secret: secret }),
  })
  if (!saveRes.ok) {
    const detail = await saveRes.text().catch(() => "")
    console.error("[2fa/setup] save_secret failed:", saveRes.status, detail)
    return NextResponse.json({ error: "Failed to save secret" }, { status: 500 })
  }

  const qrDataUrl = await buildTotpQrDataUrl(me.email, secret)
  return NextResponse.json({ secret, qrDataUrl, email: me.email })
}
