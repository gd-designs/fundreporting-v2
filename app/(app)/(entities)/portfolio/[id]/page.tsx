import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { PortfolioOverview } from "@/components/portfolio-overview"

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const portfolio = await getEntityRecord("portfolio", id)
  if (!portfolio) notFound()

  return (
    <PortfolioOverview
      entityUUID={portfolio.entity}
      portfolioId={id}
      portfolioName={portfolio.name}
    />
  )
}
