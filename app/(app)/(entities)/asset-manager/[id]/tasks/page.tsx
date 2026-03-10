import { ListTodo } from "lucide-react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

export default function Page() {
  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">Tasks</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Open and completed tasks for this entity.</p>
        </div>
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ListTodo /></EmptyMedia>
            <EmptyTitle>No tasks yet</EmptyTitle>
            <EmptyDescription>Nothing here yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  )
}
