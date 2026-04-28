import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { ImportTransactionsManager } from "@/components/import-transactions-manager"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getEntityRecord("asset-manager", id)
  if (!record) notFound()

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">Import transactions</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Drop a CSV or Excel file of transactions. Map each row to a fund and asset, then import.
          </p>
        </div>
        <ImportTransactionsManager assetManagerId={id} />
      </div>
    </div>
  )
}
