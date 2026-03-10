import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"

async function getPortfolio(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/portfolio/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json()
}

export default async function PortfolioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const portfolio = await getPortfolio(id)
  if (!portfolio) notFound()

  return <>{children}</>
}
