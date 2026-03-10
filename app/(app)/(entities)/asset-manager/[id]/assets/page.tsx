import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { AssetsManager } from "@/components/assets-manager"

export default async function AssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getEntityRecord("asset-manager", id)
  if (!record) notFound()
  const currency = (record._currency as { code?: string } | null)?.code ?? (record.base_currency as string | undefined)
  return <AssetsManager entityUUID={record.entity} baseCurrency={currency} />
}
