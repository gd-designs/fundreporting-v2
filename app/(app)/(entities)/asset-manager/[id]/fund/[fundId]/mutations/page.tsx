import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { MutationsManager } from "@/components/mutations-manager"

export default async function FundMutationsPage({
  params,
}: {
  params: Promise<{ id: string; fundId: string }>
}) {
  const { fundId } = await params
  const record = await getEntityRecord("fund", fundId)
  if (!record) notFound()

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">Value Mutations</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Record of value mutations across assets in this fund.</p>
        </div>
        <MutationsManager entityUUID={record.entity} />
      </div>
    </div>
  )
}
