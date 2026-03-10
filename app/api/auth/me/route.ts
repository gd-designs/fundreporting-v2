import { NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/auth'

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
