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
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getAuthToken()
  if (!token) return null

  try {
    const res = await fetch(`${process.env.XANO_API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) return null
    return res.json() as Promise<CurrentUser>
  } catch {
    return null
  }
}
