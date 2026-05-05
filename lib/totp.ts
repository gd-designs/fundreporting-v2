import { generateSecret, generateURI, verifySync } from "otplib"
import QRCode from "qrcode"

const ISSUER = "FundReporting"

export function generateTotpSecret(): string {
  return generateSecret()
}

export function buildTotpUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret })
}

export async function buildTotpQrDataUrl(email: string, secret: string): Promise<string> {
  return QRCode.toDataURL(buildTotpUri(email, secret), { margin: 1, width: 240 })
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const token = code.replace(/\s+/g, "")
  return verifySync({ secret, token, epochTolerance: 30 }).valid
}

export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`)
  }
  return codes
}
