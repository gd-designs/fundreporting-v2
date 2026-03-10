import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { DocumentsManager } from "@/components/documents-manager"

export default async function Page({ params }: { params: Promise<{ id: string; fundId: string }> }) {
  const { id, fundId } = await params
  const record = await getEntityRecord("fund", fundId)
  if (!record) notFound()
  return <DocumentsManager entityUUID={record.entity} basePath={`/asset-manager/${id}/fund/${fundId}`} />
}
