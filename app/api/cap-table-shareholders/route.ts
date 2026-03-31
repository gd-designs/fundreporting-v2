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

  // If an email is provided, find or create a user and auto-link to the shareholder
  if (body.email) {
    const base = process.env.PLATFORM_API_URL!
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    const checkRes = await fetch(`${base}/user/check-email`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ email: body.email }),
    })
    if (checkRes.ok) {
      const checkData: { exists: boolean; user?: { id: number } } = await checkRes.json()
      if (checkData.exists && checkData.user?.id != null) {
        body.user = checkData.user.id
      } else {
        // Create a passwordless user so reinvestments and portfolio lookups work
        const createRes = await fetch(`${base}/user`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ name: body.name ?? body.email, email: body.email }),
        })
        if (createRes.ok) {
          const newUser: { id: number } = await createRes.json()
          body.user = newUser.id
        }
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
