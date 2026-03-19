import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { FundCapTableView } from "@/components/fund-cap-table-view"

export default async function FundCapTablePage({
  params,
}: {
  params: Promise<{ id: string; fundId: string }>
}) {
  const { id: amId, fundId } = await params
  const [fund, am] = await Promise.all([
    getEntityRecord("fund", fundId),
    getEntityRecord("asset-manager", amId),
  ])
  if (!fund) notFound()

  const currencyCode = (fund._currency as { code?: string } | null)?.code ?? "EUR"

  return (
    <FundCapTableView
      fundId={fundId}
      entityUUID={fund.entity}
      amEntityUUID={am?.entity ?? null}
      currencyCode={currencyCode}
    />
  )
}
