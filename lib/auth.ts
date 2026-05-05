import { cookies } from 'next/headers'

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('authToken')?.value
}

export type CurrentUser = {
  id: number
  name: string
  email: string
  created_at: string
  avatar?: { url?: string } | null
  is_admin?: boolean
  totp_enabled?: boolean
  impersonated_by?: number | null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getAuthToken()
  if (!token) return null

  try {
    const res = await fetch(`${process.env.XANO_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const me = await res.json() as CurrentUser

    // Enrich with full user profile (avatar, etc.)
    try {
      const profileRes = await fetch(`${process.env.PLATFORM_API_URL}/user/${me.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (profileRes.ok) {
        const profile = await profileRes.json() as { avatar?: { url?: string } | null }
        return { ...me, avatar: profile.avatar ?? null }
      }
    } catch {
      // fall through — return me without avatar
    }

    return me
  } catch {
    return null
  }
}
