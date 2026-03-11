import { notFound } from "next/navigation"
import { getEntityRecord } from "@/lib/entity-page"
import { TaskManager } from "@/components/task-manager"

export default async function Page({ params }: { params: Promise<{ id: string; fundId: string }> }) {
  const { fundId } = await params
  const record = await getEntityRecord("fund", fundId)
  if (!record) notFound()
  return <TaskManager entityId={record.entity} />
}
