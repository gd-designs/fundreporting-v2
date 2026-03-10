import { NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/auth'

export async function GET() {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(`${process.env.PLATFORM_API_URL}/currency`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json([], { status: 200 })
  }

  return NextResponse.json(await res.json())
}
