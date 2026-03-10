import { NextResponse } from 'next/server'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 86400,
}

export async function POST(request: Request) {
  const body = await request.json()

  const res = await fetch(`${process.env.XANO_API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? data.message ?? 'Signup failed' },
      { status: res.status }
    )
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('authToken', data.authToken, COOKIE_OPTIONS)

  // Best-effort: link shareholders → create capital call notifications
  ;(async () => {
    const headers = { Authorization: `Bearer ${data.authToken}`, 'Content-Type': 'application/json' }
    const base = process.env.PLATFORM_API_URL
    try {
      // 1. Link shareholder records to this new user
      await fetch(`${base}/cap_table_shareholder/link-user`, { method: 'POST', headers, body: '{}' })

      // 1b. Get the numeric user ID (needed for notification.user field)
      const meRes = await fetch(`${process.env.XANO_API_URL}/auth/me`, { headers })
      const me = meRes.ok ? (await meRes.json() as { id?: number }) : {}
      const userId = me.id ?? null

      // 2. Fetch all capital calls now visible to this user
      const callsRes = await fetch(`${base}/my-capital-calls`, { headers })
      if (!callsRes.ok) return
      const calls = (await callsRes.json()) as Array<{
        id: string
        status?: string | null
        amount?: number | null
        due_date?: number | null
        entity_name?: string | null
      }>

      // 3. Create one notification per pending/partial call
      const pending = calls.filter((c) => c.status === 'pending' || c.status === 'partial')
      await Promise.allSettled(
        pending.map((cc) => {
          const amtStr = cc.amount != null
            ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(cc.amount)
            : null
          const dueStr = cc.due_date
            ? new Date(cc.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : null
          return fetch(`${base}/notification`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              user: userId,
              type: 'capital_call',
              resource_id: cc.id,
              title: `Capital call${cc.entity_name ? ` — ${cc.entity_name}` : ''}`,
              body: [amtStr && `Amount: ${amtStr}`, dueStr && `Due: ${dueStr}`].filter(Boolean).join(' · ') || null,
              read: false,
            }),
          })
        }),
      )
    } catch { /* ignore */ }
  })()

  return response
}
