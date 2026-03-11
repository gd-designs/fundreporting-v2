import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { TaskManager } from "@/components/task-manager"

const SLUG = "portfolio"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getEntityRecord(SLUG, id)
  if (!record) notFound()
  return <TaskManager entityId={record.entity} />
}
