import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { FundCapTableView } from "@/components/fund-cap-table-view"

export default async function FundCapTablePage({
  params,
}: {
  params: Promise<{ id: string; fundId: string }>
}) {
  const { fundId } = await params
  const fund = await getEntityRecord("fund", fundId)
  if (!fund) notFound()

  const currencyCode = (fund._currency as { code?: string } | null)?.code ?? "EUR"

  return (
    <FundCapTableView
      entityUUID={fund.entity}
      currencyCode={currencyCode}
    />
  )
}
