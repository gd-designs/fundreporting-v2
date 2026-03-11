import { type NextRequest, NextResponse } from "next/server"
import { getAuthToken } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()

  const res = await fetch(`${process.env.PLATFORM_API_URL}/user/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!res.ok) {
    const d = await res.json().catch(() => ({})) as { error?: string; message?: string }
    return NextResponse.json({ error: d.error ?? d.message ?? "Upload failed" }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}
