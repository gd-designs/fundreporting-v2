import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { FundPnlClient } from "@/components/fund-pnl-client"

export default async function FundProfitAndLossPage({
  params,
}: {
  params: Promise<{ id: string; fundId: string }>
}) {
  const { fundId } = await params
  const fund = await getEntityRecord("fund", fundId)
  if (!fund) notFound()

  const currencyCode = (fund._currency as { code?: string } | null)?.code ?? "EUR"

  return (
    <FundPnlClient
      entityUUID={fund.entity}
      currencyCode={currencyCode}
    />
  )
}
