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

  const res = await fetch(`${process.env.XANO_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? data.message ?? 'Login failed' },
      { status: res.status }
    )
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('authToken', data.authToken, COOKIE_OPTIONS)
  return response
}
