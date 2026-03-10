import { getAuthToken } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([])

  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset_class`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (!res.ok) return NextResponse.json([])
  return NextResponse.json(await res.json())
}
