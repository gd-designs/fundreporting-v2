import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { AssetsManager } from "@/components/assets-manager"

export default async function FundAssetsPage({
  params,
}: {
  params: Promise<{ id: string; fundId: string }>
}) {
  const { fundId } = await params
  const record = await getEntityRecord("fund", fundId)
  if (!record) notFound()
  const currency = (record._currency as { code?: string } | null)?.code ?? undefined
  return <AssetsManager entityUUID={record.entity} baseCurrency={currency} />
}
