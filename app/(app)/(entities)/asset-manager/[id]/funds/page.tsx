import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { FundsManager } from "@/components/funds-manager"

async function getAssetManager(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset_manager/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; name?: string | null; currency?: number | null; country?: number | null }>
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

export default async function FundsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [assetManager, funds] = await Promise.all([getAssetManager(id), getFunds(id)])
  if (!assetManager) notFound()

  return (
    <div className="p-6 md:p-8">
      <FundsManager
        assetManagerId={id}
        initialFunds={funds}
        defaultCurrency={assetManager.currency}
        defaultCountry={assetManager.country}
      />
    </div>
  )
}
