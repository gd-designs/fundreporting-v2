import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { FamilyOfficeOverview } from "@/components/family-office-overview"

async function getFamilyOffice(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/family_office/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    id: string
    entity: string
    name: string | null
    country: string | null
    _country?: { id: number; name: string } | null
  }>
}

export default async function FamilyOfficePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const familyOffice = await getFamilyOffice(id)
  if (!familyOffice) notFound()

  return (
    <FamilyOfficeOverview
      entityUUID={familyOffice.entity}
      familyOfficeId={familyOffice.id}
      familyOfficeName={familyOffice.name}
      country={familyOffice._country?.name ?? null}
    />
  )
}
