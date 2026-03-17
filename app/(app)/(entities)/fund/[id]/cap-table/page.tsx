import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { FundCapTableView } from "@/components/fund-cap-table-view"

async function getRecord(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/fund/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; entity: string; name?: string | null; _currency?: { id: number; code: string } | null }>
}

export default async function CapTablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getRecord(id)
  if (!record) notFound()
  return (
    <FundCapTableView
      entityUUID={record.entity}
      fundName={record.name ?? undefined}
      currencyCode={record._currency?.code}
    />
  )
}
