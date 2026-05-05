"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ImpersonationBanner({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function stop() {
    setBusy(true)
    try {
      const r = await fetch("/api/auth/stop-impersonating", { method: "POST" })
      if (r.ok) {
        router.push("/admin/users")
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 border-b bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
      <ShieldAlert className="size-4 shrink-0" />
      <div className="flex-1">
        Viewing as <span className="font-medium">{name}</span>{" "}
        <span className="text-amber-700 dark:text-amber-300">({email})</span>
      </div>
      <Button size="sm" variant="outline" onClick={stop} disabled={busy}>
        Stop impersonating
      </Button>
    </div>
  )
}
