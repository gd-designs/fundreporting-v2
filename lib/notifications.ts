import { getAuthToken } from "@/lib/auth"

export type Notification = {
  id: string
  type: "capital_call" | string
  resource_id: string | null
  title: string | null
  body: string | null
  read: boolean | null
  read_at: number | null
  dismissed: boolean | null
  created_at: number
}

export async function getNotifications(): Promise<Notification[]> {
  const token = await getAuthToken()
  if (!token) return []
  const res = await fetch(`${process.env.PLATFORM_API_URL}/notification`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  return res.json()
}

export async function getUnreadCount(): Promise<number> {
  const notifications = await getNotifications()
  return notifications.filter((n) => !n.read).length
}
