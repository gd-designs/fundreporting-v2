import { getEntities } from "@/lib/entities"
import { TaskManager } from "@/components/task-manager"

export default async function TasksPage() {
  const entities = await getEntities()
  return (
    <TaskManager
      entities={entities}
      title="All Tasks"
      description="Tasks across all your entities."
    />
  )
}
