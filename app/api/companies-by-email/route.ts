import { getAuthToken } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export type CompanyOption = {
  entityId: string
  companyId: string
  name: string
}

export async function GET(req: NextRequest) {
  const token = await getAuthToken()
  if (!token) return NextResponse.json([], { status: 401 })

  const email = req.nextUrl.searchParams.get("email")
  if (!email) return NextResponse.json([])

  const base = process.env.PLATFORM_API_URL!
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // Resolve user by email
  const checkRes = await fetch(`${base}/user/check-email`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ email }),
  })
  if (!checkRes.ok) return NextResponse.json([])
  const checkData: { exists: boolean; user?: { id: number } } = await checkRes.json()
  if (!checkData.exists || checkData.user?.id == null) return NextResponse.json([])

  // Fetch companies owned by this user
  const companiesRes = await fetch(`${base}/company/by-owner`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ owner: checkData.user.id }),
  })
  if (!companiesRes.ok) return NextResponse.json([])

  const raw: Array<{
    id: string
    _company?: { id: string; name?: string | null } | null
  }> = await companiesRes.json()

  const options: CompanyOption[] = raw
    .filter((r) => r._company?.id)
    .map((r) => ({
      entityId: r.id,
      companyId: r._company!.id,
      name: r._company!.name ?? "Unnamed company",
    }))

  return NextResponse.json(options)
}
