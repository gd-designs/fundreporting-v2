import { getEntities } from "@/lib/entities"
import { TaskManager } from "@/components/task-manager"

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const [entities, params] = await Promise.all([getEntities(), searchParams])
  return (
    <TaskManager
      entities={entities}
      title="All Tasks"
      description="Tasks across all your entities."
      openTaskId={params.task}
    />
  )
}
