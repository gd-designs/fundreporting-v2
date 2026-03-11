import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { InvestorsManager } from "@/components/investors-manager"

async function getAssetManager(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset_manager/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; entity: string; name?: string | null; country?: number | null }>
}

async function getCountryCode(countryId: number): Promise<string | null> {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/country/${countryId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "force-cache",
  })
  if (!res.ok) return null
  const data = await res.json() as { code?: string | null }
  return data.code?.toUpperCase() ?? null
}

async function getLeads(assetManagerId: string) {
  const token = await getAuthToken()
  if (!token) return []
  const res = await fetch(
    `${process.env.PLATFORM_API_URL}/investor_lead?asset_manager=${encodeURIComponent(assetManagerId)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  )
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function getFunds(assetManagerId: string) {
  const token = await getAuthToken()
  if (!token) return []
  const res = await fetch(
    `${process.env.PLATFORM_API_URL}/fund?managed_by=${encodeURIComponent(assetManagerId)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  )
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export default async function InvestorsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [assetManager, leads, funds] = await Promise.all([
    getAssetManager(id),
    getLeads(id),
    getFunds(id),
  ])
  if (!assetManager) notFound()

  const defaultPhoneCountry = assetManager.country
    ? await getCountryCode(assetManager.country)
    : null

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto">
        <InvestorsManager
          assetManagerId={id}
          entityId={assetManager.entity}
          funds={funds}
          initialLeads={leads}
          defaultPhoneCountry={defaultPhoneCountry ?? undefined}
        />
      </div>
    </div>
  )
}
