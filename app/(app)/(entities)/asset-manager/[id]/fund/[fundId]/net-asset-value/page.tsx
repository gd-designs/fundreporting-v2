import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { FundNavPageClient } from "@/components/fund-nav-page-client"

async function getFund(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/fund/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    id: string
    entity: string
    name?: string | null
    _currency?: { code?: string | null } | null
  }>
}

export default async function FundNavPage({
  params,
}: {
  params: Promise<{ id: string; fundId: string }>
}) {
  const { fundId } = await params
  const fund = await getFund(fundId)
  if (!fund) notFound()

  const currencyCode = fund._currency?.code ?? "EUR"

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Net Asset Value</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Period management and NAV history for {fund.name ?? "this fund"}.
          </p>
        </div>

        <FundNavPageClient
          entityUUID={fund.entity}
          currencyCode={currencyCode}
        />
      </div>
    </div>
  )
}
