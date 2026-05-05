"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Loader2, ShieldCheck, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Me = { id: number; name: string; email: string; totp_enabled?: boolean }

type SetupData = { secret: string; qrDataUrl: string; email: string }

export default function SecurityPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [setup, setSetup] = useState<SetupData | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const r = await fetch("/api/auth/me")
      if (r.ok) setMe(await r.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function startSetup() {
    setError(null)
    setBusy(true)
    try {
      const r = await fetch("/api/auth/2fa/setup", { method: "POST" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error ?? "Failed to start setup")
        return
      }
      setSetup(d as SetupData)
      setCode("")
    } finally {
      setBusy(false)
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!code.trim()) {
      setError("Enter the 6-digit code from your authenticator")
      return
    }
    setBusy(true)
    try {
      const r = await fetch("/api/auth/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error ?? "Invalid code")
        return
      }
      setRecoveryCodes(d.recoveryCodes ?? [])
      setSetup(null)
      setCode("")
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function disable2FA() {
    setError(null)
    if (!code.trim()) {
      setError("Enter your current authenticator code to disable")
      return
    }
    setBusy(true)
    try {
      const r = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error ?? "Invalid code")
        return
      }
      setCode("")
      setRecoveryCodes(null)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function copyRecovery() {
    if (!recoveryCodes) return
    await navigator.clipboard.writeText(recoveryCodes.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="size-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Security</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-factor authentication</CardTitle>
          <CardDescription>
            Add an extra step at sign-in using an authenticator app (1Password, Authy, Google Authenticator, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading…
            </div>
          ) : recoveryCodes ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                2FA is enabled. Save these recovery codes somewhere safe — each can be used once if you lose access to your authenticator.
              </p>
              <pre className="rounded-md border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap">{recoveryCodes.join("\n")}</pre>
              <div>
                <Button size="sm" variant="outline" onClick={copyRecovery}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy codes"}
                </Button>
              </div>
            </div>
          ) : me?.totp_enabled ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm">2FA is currently <span className="font-medium text-foreground">enabled</span>.</p>
              <div className="grid gap-1.5 max-w-xs">
                <Label htmlFor="disable-code">Authenticator code</Label>
                <Input
                  id="disable-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div>
                <Button size="sm" variant="destructive" onClick={disable2FA} disabled={busy}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : setup ? (
            <form onSubmit={confirmSetup} className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <Image
                  src={setup.qrDataUrl}
                  alt="Scan with your authenticator app"
                  width={200}
                  height={200}
                  className="rounded-md border bg-white"
                  unoptimized
                />
                <div className="flex flex-col gap-2 text-sm">
                  <p>1. Scan the QR code with your authenticator app.</p>
                  <p>
                    Or enter this key manually:
                    <br />
                    <span className="font-mono text-xs break-all">{setup.secret}</span>
                  </p>
                  <p>2. Enter the 6-digit code the app generates to confirm.</p>
                </div>
              </div>
              <div className="grid gap-1.5 max-w-xs">
                <Label htmlFor="confirm-code">6-digit code</Label>
                <Input
                  id="confirm-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Confirm and enable
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setSetup(null); setCode(""); setError(null) }}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">2FA is currently disabled.</p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div>
                <Button size="sm" onClick={startSetup} disabled={busy}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Enable 2FA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
