"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get("email") ?? "")
  const [code, setCode] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [stage, setStage] = useState<"email" | "code" | "totp">("email")
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError("Enter your email")
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Failed to send code. Try again.")
        return
      }
      setStage("code")
      setInfo(`We sent a 6-digit code to ${email.trim().toLowerCase()}. It expires in 10 minutes.`)
    } finally {
      setSending(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!code.trim() || code.trim().length !== 6) {
      setError("Enter the 6-digit code")
      return
    }
    setVerifying(true)
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Invalid or expired code")
        return
      }
      if (data.requires2FA && data.challengeToken) {
        setChallengeToken(data.challengeToken)
        setStage("totp")
        setInfo("Enter the 6-digit code from your authenticator app, or a recovery code.")
        setCode("")
        return
      }
      router.push("/dashboard")
    } finally {
      setVerifying(false)
    }
  }

  async function handleTotpExchange(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!totpCode.trim()) {
      setError("Enter your authenticator or recovery code")
      return
    }
    if (!challengeToken) {
      setError("Session expired. Start over.")
      setStage("email")
      return
    }
    setVerifying(true)
    try {
      const res = await fetch("/api/auth/2fa/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code: totpCode.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Invalid code")
        return
      }
      router.push("/dashboard")
    } finally {
      setVerifying(false)
    }
  }

  function resetToEmail() {
    setStage("email")
    setCode("")
    setTotpCode("")
    setChallengeToken(null)
    setError(null)
    setInfo(null)
  }

  if (stage === "email") {
    return (
      <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? "Sending code..." : "Send sign-in code"}
        </Button>
      </form>
    )
  }

  if (stage === "code") {
    return (
      <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{info}</p>
        <Field>
          <FieldLabel htmlFor="code">6-digit code</FieldLabel>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            autoFocus
            required
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" className="w-full" disabled={verifying}>
          {verifying ? "Signing in..." : "Sign in"}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={resetToEmail}
        >
          Use a different email
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleTotpExchange} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{info}</p>
      <Field>
        <FieldLabel htmlFor="totp">Authenticator code</FieldLabel>
        <Input
          id="totp"
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          placeholder="123456 or recovery-code"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value)}
          autoFocus
          required
        />
      </Field>
      {error && <FieldError>{error}</FieldError>}
      <Button type="submit" className="w-full" disabled={verifying}>
        {verifying ? "Verifying..." : "Verify"}
      </Button>
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={resetToEmail}
      >
        Start over
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>We&apos;ll email you a one-time code.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="flex flex-col gap-4 animate-pulse"><div className="h-10 bg-muted rounded" /><div className="h-10 bg-muted rounded" /><div className="h-10 bg-muted rounded" /></div>}>
          <LoginForm />
        </Suspense>
      </CardContent>
      <CardFooter className="justify-center text-xs text-muted-foreground">
        Codes expire after 10 minutes. Up to 5 attempts per code.
      </CardFooter>
    </Card>
  )
}
