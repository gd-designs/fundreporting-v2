import { type NextRequest, NextResponse } from "next/server"
import { getCachedEntityStats, setCachedEntityStats } from "@/lib/entity-stats-cache"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const { entityId } = await params
  const stats = getCachedEntityStats(entityId)
  if (!stats) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(stats)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const { entityId } = await params
  const body = await req.json() as { netValue: number; liabilitiesValue: number; assetsCount: number }
  setCachedEntityStats(entityId, body)
  return NextResponse.json({ ok: true })
}
