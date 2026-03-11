import { notFound } from "next/navigation"
import Link from "next/link"
import { getAuthToken } from "@/lib/auth"
import { ArrowLeftRight, BarChart3, RefreshCcw, Table, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(ts))
}

function formatAum(aum: number, code?: string | null) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code ?? "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(aum)
  } catch {
    return aum.toLocaleString()
  }
}

export default async function FundOverviewPage({
  params,
}: {
  params: Promise<{ id: string; fundId: string }>
}) {
  const { id: amId, fundId } = await params
  const fund = await getFund(fundId)
  if (!fund) notFound()

  const base = `/asset-manager/${amId}/fund/${fundId}`
  const currencyCode = fund._currency?.code ?? null

  const quickLinks = [
    { href: `${base}/cap-table`, label: "Cap Table", description: "Shareholders and capital calls", icon: Table },
    { href: `${base}/transactions`, label: "Transactions", description: "All recorded movements", icon: ArrowLeftRight },
    { href: `${base}/mutations`, label: "Mutations", description: "Asset value mutations", icon: RefreshCcw },
    { href: `${base}/profit-and-loss`, label: "Profit & Loss", description: "Income and expense summary", icon: TrendingUp },
    { href: `${base}/net-asset-value`, label: "Net Asset Value", description: "NAV over time", icon: BarChart3 },
  ]

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{fund.name ?? "Unnamed Fund"}</h1>
            {fund.fund_type && (
              <Badge variant="secondary" className="capitalize">
                {FUND_TYPE_LABELS[fund.fund_type] ?? fund.fund_type}
              </Badge>
            )}
          </div>
          {fund._country?.name && (
            <p className="text-sm text-muted-foreground">{fund._country.name}</p>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Currency</p>
            <p className="text-lg font-semibold">{currencyCode ?? "—"}</p>
            {fund._currency?.name && (
              <p className="text-xs text-muted-foreground mt-0.5">{fund._currency.name}</p>
            )}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Fund Type</p>
            <p className="text-lg font-semibold">
              {fund.fund_type ? (FUND_TYPE_LABELS[fund.fund_type] ?? fund.fund_type) : "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Inception Date</p>
            <p className="text-lg font-semibold">
              {fund.inception_date ? formatDate(fund.inception_date) : "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Reported AUM</p>
            <p className="text-lg font-semibold">
              {fund.aum != null && fund.aum > 0 ? formatAum(fund.aum, currencyCode) : "—"}
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Fund sections</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickLinks.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
