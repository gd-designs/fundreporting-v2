import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { getEntities } from "@/lib/entities"
import { FamilyOfficeTransactions } from "@/components/family-office-transactions"

async function getFamilyOffice(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/family_office/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; entity: string; name: string | null }>
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [familyOffice, allEntities] = await Promise.all([
    getFamilyOffice(id),
    getEntities(),
  ])
  if (!familyOffice) notFound()

  const allPortfolios = allEntities.filter((e) => e.type === "portfolio")

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">Transaction Ledger</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Aggregated transactions across all member portfolios. Read-only view.
          </p>
        </div>
        <FamilyOfficeTransactions
          familyOfficeId={familyOffice.id}
          allPortfolios={allPortfolios}
        />
      </div>
    </div>
  )
}
