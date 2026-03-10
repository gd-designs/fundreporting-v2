import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const entity = req.nextUrl.searchParams.get("entity")
  const url = entity
    ? `${process.env.PLATFORM_API_URL}/entity_member?entity=${entity}`
    : `${process.env.PLATFORM_API_URL}/entity_member`

  const res = await fetch(url, {
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

  // Resolve user id from email if provided
  if (body.email) {
    const checkRes = await fetch(`${process.env.PLATFORM_API_URL}/user/check-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email }),
    })
    if (checkRes.ok) {
      const checkData: { exists: boolean; user?: { id: number } } = await checkRes.json()
      if (!checkData.exists || checkData.user?.id == null) {
        return NextResponse.json({ error: "No user found with that email address." }, { status: 404 })
      }
      body.user = checkData.user.id
    }
    delete body.email
  }

  const res = await fetch(`${process.env.PLATFORM_API_URL}/entity_member`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
