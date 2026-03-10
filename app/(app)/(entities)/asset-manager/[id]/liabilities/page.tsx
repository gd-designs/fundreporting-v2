import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { LiabilitiesManager } from "@/components/liabilities-manager"

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ liability?: string }>
}) {
  const { id } = await params
  const { liability } = await searchParams
  const record = await getEntityRecord("asset-manager", id)
  if (!record) notFound()

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">Liabilities</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Outstanding liabilities across assets in this entity.</p>
        </div>
        <LiabilitiesManager entityUUID={record.entity} initialLiabilityId={liability} />
      </div>
    </div>
  )
}
