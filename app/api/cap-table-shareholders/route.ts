import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const entity = req.nextUrl.searchParams.get("entity")

  const url = new URL(`${process.env.PLATFORM_API_URL}/cap_table_shareholder`)
  if (entity) url.searchParams.set("entity", entity)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json([], { status: res.status })

  return NextResponse.json(await res.json())
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // If an email is provided, check if it belongs to an existing user and auto-link
  if (body.email) {
    const checkRes = await fetch(`${process.env.PLATFORM_API_URL}/user/check-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email }),
    })
    if (checkRes.ok) {
      const checkData: { exists: boolean; user?: { id: number } } = await checkRes.json()
      if (checkData.exists && checkData.user?.id != null) {
        body.user = checkData.user.id
      }
    }
  }

  const res = await fetch(`${process.env.PLATFORM_API_URL}/cap_table_shareholder`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
