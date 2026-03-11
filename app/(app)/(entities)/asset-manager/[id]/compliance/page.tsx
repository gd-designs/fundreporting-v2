import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { ComplianceManager } from "@/components/compliance-manager"
import type { ComplianceRecord } from "@/components/add-compliance-dialog"

async function getAssetManager(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset_manager/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; entity: string; name?: string | null }>
}

async function getComplianceRecords(assetManagerId: string): Promise<ComplianceRecord[]> {
  const token = await getAuthToken()
  if (!token) return []
  const res = await fetch(`${process.env.PLATFORM_API_URL}/compliance_record`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  const data = await res.json()
  const records = Array.isArray(data) ? data : []
  return records.filter(
    (r: { asset_manager?: string }) => r.asset_manager === assetManagerId,
  ) as ComplianceRecord[]
}

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [assetManager, records] = await Promise.all([
    getAssetManager(id),
    getComplianceRecords(id),
  ])
  if (!assetManager) notFound()

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto">
        <ComplianceManager
          assetManagerId={id}
          initialRecords={records}
        />
      </div>
    </div>
  )
}
