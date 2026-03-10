import { Plus } from "lucide-react";
import { AddEntityDialog } from "@/components/add-entity-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import { getEntities } from "@/lib/entities";
import type { UnifiedEntity } from "@/lib/types";

const TYPE_LABELS: Record<UnifiedEntity["type"], string> = {
  portfolio: "Portfolio",
  company: "Company",
  family_office: "Family Office",
  asset_manager: "Asset Manager",
  fund: "Fund",
};

export default async function EntitiesPage() {
  const entities = await getEntities();

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Entities</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Manage your portfolios, companies, and other entities.
            </p>
          </div>
          <AddEntityDialog>
            <Button size="sm">
              <Plus />
              Add entity
            </Button>
          </AddEntityDialog>
        </div>

        {entities.length === 0 ? (
          <Empty className="border py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Plus />
              </EmptyMedia>
              <EmptyTitle>No entities yet</EmptyTitle>
              <EmptyDescription>
                Add your first entity to get started.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <AddEntityDialog>
                <Button variant="outline" size="sm">
                  <Plus />
                  Add entity
                </Button>
              </AddEntityDialog>
            </EmptyContent>
          </Empty>
        ) : (
          <ItemGroup>
            {entities.map((entity) => (
              <Item key={entity.id} variant="outline">
                <ItemContent>
                  <ItemTitle>{entity.name ?? "—"}</ItemTitle>
                  <ItemDescription>
                    Created{" "}
                    {new Date(entity.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="secondary">{TYPE_LABELS[entity.type]}</Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </div>
    </div>
  );
}
