import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { CompanyOverview } from "@/components/company-overview"

async function getCompany(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/company/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    id: string
    entity: string
    name: string | null
    industry: string | null
    country: string | null
    _country?: { id: number; name: string } | null
    registration_number: string | null
  }>
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const company = await getCompany(id)
  if (!company) notFound()

  return (
    <CompanyOverview
      entityUUID={company.entity}
      companyId={company.id}
      companyName={company.name}
      industry={company.industry}
      country={company._country?.name ?? null}
      registrationNumber={company.registration_number}
    />
  )
}
