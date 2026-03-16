import { notFound } from "next/navigation"
import { getAuthToken, getCurrentUser } from "@/lib/auth"
import { CapTableManager } from "@/components/cap-table-manager"

async function getRecord(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/family_office/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; entity: string; name?: string | null; country?: string | null; _entity?: { owner?: number | null } | null }>
}

export default async function CapTablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [record, currentUser] = await Promise.all([getRecord(id), getCurrentUser()])
  if (!record) notFound()
  const countryId = record.country ? Number(record.country) : null
  return <CapTableManager entityUUID={record.entity} entityName={record.name ?? undefined} defaultCountryId={isNaN(countryId ?? NaN) ? null : countryId} currentUserId={currentUser?.id} entityOwner={record._entity?.owner ?? null} />
}
