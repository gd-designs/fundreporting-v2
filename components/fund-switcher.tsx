"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronsUpDown, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type FundItem = {
  id: string
  name?: string | null
}

function initials(name: string | null | undefined) {
  if (!name) return "??"
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function FundSwitcher({
  amId,
  amName,
  fundId,
  funds,
}: {
  amId: string
  amName: string | null
  fundId: string
  funds: FundItem[]
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const activeFund = funds.find((f) => f.id === fundId)

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
                {initials(activeFund?.name)}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeFund?.name ?? "Fund"}
                </span>
                <span className="truncate text-xs">Fund</span>
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
            {/* Back to asset manager */}
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link href={`/asset-manager/${amId}`}>
                <div className="flex size-8 items-center justify-center rounded-md border">
                  <ArrowLeft className="size-3.5" />
                </div>
                <div className="flex flex-col">
                  <span>{amName ?? "Asset Manager"}</span>
                  <span className="text-xs text-muted-foreground">
                    Asset Manager
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Your funds
            </DropdownMenuLabel>
            {funds.map((fund) => (
              <DropdownMenuItem
                key={fund.id}
                onClick={() =>
                  router.push(`/asset-manager/${amId}/fund/${fund.id}`)
                }
                className="gap-2 p-2"
              >
                <div className="flex size-8 items-center justify-center rounded-md border text-xs font-bold">
                  {initials(fund.name)}
                </div>
                <div className="flex flex-col">
                  <span>{fund.name ?? "Unnamed fund"}</span>
                  <span className="text-xs text-muted-foreground">Fund</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() =>
                router.push(`/asset-manager/${amId}?new-fund=1`)
              }
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">New Fund</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
