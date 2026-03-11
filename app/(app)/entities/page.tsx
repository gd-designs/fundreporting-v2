import { Plus } from "lucide-react"
import { AddEntityDialog } from "@/components/add-entity-dialog"
import { EntitiesManager } from "@/components/entities-manager"
import { Button } from "@/components/ui/button"
import { getEntities } from "@/lib/entities"

export default async function EntitiesPage() {
  const entities = await getEntities()

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Entities</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Your portfolios, companies, and other managed entities.
            </p>
          </div>
          <AddEntityDialog>
            <Button size="sm">
              <Plus className="size-3.5" />
              Add entity
            </Button>
          </AddEntityDialog>
        </div>
        <EntitiesManager entities={entities} />
      </div>
    </div>
  )
}
