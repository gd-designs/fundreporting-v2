import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"

async function getFund(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/fund/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json()
}

export default async function FundPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const fund = await getFund(id)
  if (!fund) notFound()

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-muted-foreground text-sm">Overview coming soon.</p>
      </div>
    </div>
  )
}
