"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronsUpDown, LayoutDashboard, Plus } from "lucide-react";
import type { EntityType, UnifiedEntity } from "@/lib/types";

const TYPE_SLUGS: Record<EntityType, string> = {
  portfolio: "portfolio",
  company: "company",
  fund: "fund",
  family_office: "family-office",
  asset_manager: "asset-manager",
};

// Sub-pages not supported by every entity type
const TYPE_EXCLUDED_PAGES: Partial<Record<EntityType, string[]>> = {
  portfolio: ["cap-table"],
}

function entityPath(entity: UnifiedEntity, subPage: string | null): string {
  const base = `/${TYPE_SLUGS[entity.type]}/${entity.id}`
  if (!subPage) return base
  const excluded = TYPE_EXCLUDED_PAGES[entity.type] ?? []
  if (excluded.includes(subPage)) return base
  return `${base}/${subPage}`
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { AddEntityDialog } from "@/components/add-entity-dialog";

const TYPE_LABELS: Record<UnifiedEntity["type"], string> = {
  portfolio: "Portfolio",
  company: "Company",
  family_office: "Family Office",
  asset_manager: "Asset Manager",
  fund: "Fund",
};

function initials(name: string | null) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function EntitySwitcher({ entities }: { entities: UnifiedEntity[] }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/dashboard";
  // Extract current sub-page (e.g. "assets", "cap-table") from pathname
  const currentSubPage = React.useMemo(() => {
    const m = pathname.match(/^\/(portfolio|company|fund|family-office|asset-manager)\/[^/]+\/(.+)/)
    return m ? m[2] : null
  }, [pathname])
  // Ref so the keyboard handler always reads the latest value without changing deps array size
  const currentSubPageRef = React.useRef(currentSubPage)
  currentSubPageRef.current = currentSubPage
  const [activeEntity, setActiveEntity] = React.useState<
    UnifiedEntity | undefined
  >(entities[0]);

  // Stable shortcut order: sorted by creation time ascending so new entities always get the next number
  const sortedEntities = React.useMemo(
    () => [...entities].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    [entities],
  )

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.metaKey) return
      const n = parseInt(e.key)
      if (!n || n < 1 || n > sortedEntities.length) return
      e.preventDefault()
      const entity = sortedEntities[n - 1]
      setActiveEntity(entity)
      router.push(entityPath(entity, currentSubPageRef.current))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sortedEntities, router])

  React.useEffect(() => {
    // Sync active entity from URL: match /<type-slug>/<id> pattern
    const match = pathname.match(/^\/(portfolio|company|fund|family-office|asset-manager)\/([^/]+)/)
    if (match) {
      const found = entities.find((e) => e.id === match[2])
      if (found) { setActiveEntity(found); return }
    }
    if (!activeEntity && entities.length > 0) setActiveEntity(entities[0]);
  }, [pathname, entities, activeEntity]);

  if (entities.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <AddEntityDialog>
            <SidebarMenuButton size="lg" className="text-muted-foreground">
              <div className="flex size-8 items-center justify-center rounded-lg border">
                <Plus className="size-4" />
              </div>
              <span className="font-medium group-data-[collapsible=icon]:hidden">
                New Entity
              </span>
            </SidebarMenuButton>
          </AddEntityDialog>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                {isHome ? (
                  <LayoutDashboard className="size-4" />
                ) : (
                  initials(activeEntity?.name ?? null)
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {isHome ? "Home" : (activeEntity?.name ?? "—")}
                </span>
                <span className="truncate text-xs">
                  {isHome
                    ? "Dashboard"
                    : activeEntity
                      ? TYPE_LABELS[activeEntity.type]
                      : ""}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuItem
              onClick={() => router.push("/dashboard")}
              className="gap-2 p-2"
            >
              <div className="flex size-8 items-center justify-center rounded-md border">
                <LayoutDashboard className="size-3.5" />
              </div>
              <div className="flex flex-col">
                <span>Home</span>
                <span className="text-xs text-muted-foreground">Dashboard</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Your entities
            </DropdownMenuLabel>
            {sortedEntities.map((entity, index) => (
              <DropdownMenuItem
                key={entity.id}
                onClick={() => {
                  setActiveEntity(entity);
                  router.push(entityPath(entity, currentSubPage));
                }}
                className="gap-2 p-2"
              >
                <div className="flex size-8 items-center justify-center rounded-md border text-xs font-bold">
                  {initials(entity.name)}
                </div>
                <div className="flex flex-col">
                  <span>{entity.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {TYPE_LABELS[entity.type]}
                  </span>
                </div>
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <AddEntityDialog>
              <DropdownMenuItem
                className="gap-2 p-2"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  New Entity
                </div>
              </DropdownMenuItem>
            </AddEntityDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
