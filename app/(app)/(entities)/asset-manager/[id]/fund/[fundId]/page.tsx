import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { FundOverview } from "@/components/fund-overview"

type FundRecord = {
  id: string
  entity: string
  name?: string | null
  fund_type?: "alternative_investment" | "structured_product" | "regulated_fund" | null
  inception_date?: number | null
  aum?: number | null
  _currency?: { code?: string | null; name?: string | null } | null
  _country?: { code?: string | null; name?: string | null } | null
}

const FUND_TYPE_LABELS: Record<string, string> = {
  alternative_investment: "Alternative Investment",
  structured_product: "Structured Product",
  regulated_fund: "Regulated Fund",
}

async function getFund(id: string): Promise<FundRecord | null> {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/fund/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json()
}

export default async function FundOverviewPage({
  params,
}: {
  params: Promise<{ id: string; fundId: string }>
}) {
  const { id: amId, fundId } = await params
  const fund = await getFund(fundId)
  if (!fund) notFound()

  const currencyCode = fund._currency?.code ?? "EUR"

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{fund.name ?? "Unnamed Fund"}</h1>
            {fund.fund_type && (
              <Badge variant="secondary">
                {FUND_TYPE_LABELS[fund.fund_type] ?? fund.fund_type}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {[fund._country?.name, currencyCode].filter(Boolean).join(" · ")}
          </p>
        </div>

        {/* Walkthrough + quick links */}
        <FundOverview
          entityUUID={fund.entity}
          fundId={fundId}
          amId={amId}
          currencyCode={currencyCode}
        />

      </div>
    </div>
  )
}
