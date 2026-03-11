import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { getAuthToken } from '@/lib/auth'

export async function PATCH(request: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const res = await fetch(`${process.env.XANO_API_URL}/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    return NextResponse.json({ error: d.error ?? d.message ?? 'Update failed' }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}

export async function GET() {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(`${process.env.XANO_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? data.message ?? 'Unauthorized' },
      { status: res.status }
    )
  }

  return NextResponse.json(data)
}
