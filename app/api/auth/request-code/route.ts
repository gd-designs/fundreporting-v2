import { NextResponse } from "next/server"
import { Resend } from "resend"

// POST /api/auth/request-code
// Body: { email: string }
// 1. Calls Xano /auth/request_code → creates an email_otp row + returns plain code.
// 2. Sends the code via Resend to the user.
// 3. Returns { success: true } only — never returns the code itself.
export async function POST(request: Request) {
  const { email } = (await request.json()) as { email?: string }
  if (!email || !email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  // 1. Generate + store via Xano
  const xanoRes = await fetch(`${process.env.XANO_API_URL}/auth/request_code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  if (!xanoRes.ok) {
    const detail = await xanoRes.text().catch(() => "")
    console.error("[request-code] Xano error:", xanoRes.status, detail)
    return NextResponse.json({ error: "Failed to generate code" }, { status: 500 })
  }
  const { code } = (await xanoRes.json()) as { code: string }

  // 2. Send via Resend
  const apiKey = process.env.RESEND_API_KEY
  const fromAddr = process.env.RESEND_FROM_EMAIL ?? process.env.RESEND_FROM ?? "FundReporting <noreply@fundreporting.com>"
  if (!apiKey) {
    console.error("[request-code] RESEND_API_KEY not configured")
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
  }
  const resend = new Resend(apiKey)
  const subject = "Your FundReporting sign-in code"
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111;">
      <h1 style="font-size:18px;margin:0 0 12px;">Sign in to FundReporting</h1>
      <p style="font-size:14px;color:#555;margin:0 0 24px;">Use this code to finish signing in. It expires in 10 minutes.</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f5f5f5;padding:16px 24px;border-radius:8px;text-align:center;margin:0 0 24px;">${code}</div>
      <p style="font-size:12px;color:#888;margin:0;">Didn&apos;t request this? You can ignore this email.</p>
    </div>
  `
  const text = `Sign in to FundReporting\n\nYour code: ${code}\nExpires in 10 minutes.\n\nIf you didn't request this, ignore this email.`

  const sendRes = await resend.emails.send({
    from: fromAddr,
    to: email.trim().toLowerCase(),
    subject,
    html,
    text,
  })
  if (sendRes.error) {
    console.error("[request-code] Resend error:", sendRes.error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
