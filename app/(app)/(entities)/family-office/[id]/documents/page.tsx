import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { DocumentsManager } from "@/components/documents-manager"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getEntityRecord("family-office", id)
  if (!record) notFound()
  return <DocumentsManager entityUUID={record.entity} basePath={`/family-office/${id}`} />
}
