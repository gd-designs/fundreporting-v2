import { getAuthToken } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const res = await fetch(`${process.env.PLATFORM_API_URL}/my-capital-calls`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json([])
  const data = await res.json()
  return NextResponse.json(Array.isArray(data) ? data : [])
}
