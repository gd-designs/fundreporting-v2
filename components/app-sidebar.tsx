"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CheckSquare,
  ChevronRight,
  CircleMinus,
  CirclePlus,
  FileText,
  Globe,
  LayoutDashboard,
  Landmark,
  ListTodo,
  Plus,
  RefreshCcw,
  Shield,
  Star,
  Table,
  TrendingUp,
  Users,
  Users2,
  X,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { NavUser } from "@/components/nav-user"
import { EntitySwitcher } from "@/components/entity-switcher"
import { FundSwitcher, type FundItem } from "@/components/fund-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import type { CurrentUser } from "@/lib/auth"
import type { EntityType, UnifiedEntity } from "@/lib/types"

const NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Entities", url: "/entities", icon: Building2 },
  { title: "All Tasks", url: "/tasks", icon: CheckSquare },
  { title: "All Documents", url: "/documents", icon: FileText },
]

const DOCS_ITEMS = [
  { title: "Introduction", url: "https://docs.fundreporting.com/introduction" },
  { title: "Get Started", url: "https://docs.fundreporting.com/get-started" },
  { title: "Tutorials", url: "https://docs.fundreporting.com/tutorials" },
  { title: "Changelog", url: "https://docs.fundreporting.com/changelog" },
]

const ENTITY_TYPE_ICONS: Record<string, React.ElementType> = {
  portfolio: Landmark,
  fund: Landmark,
  company: Building2,
  family_office: Users,
  asset_manager: BarChart3,
}

const ENTITY_HREFS: Record<string, string> = {
  portfolio: "/portfolio",
  company: "/company",
  fund: "/fund",
  family_office: "/family-office",
  asset_manager: "/asset-manager",
}

const QUICK_ACCESS_KEY = "sidebar:quick-access"

const ENTITY_SLUGS: Record<string, EntityType> = {
  portfolio: "portfolio",
  company: "company",
  fund: "fund",
  "family-office": "family_office",
  "asset-manager": "asset_manager",
}

function parseEntityRoute(pathname: string): { slug: string; id: string } | null {
  // Exclude nested fund-in-AM routes
  if (pathname.match(/^\/asset-manager\/[^/]+\/fund\//)) return null
  const match = pathname.match(/^\/([^/]+)\/([^/]+)/)
  if (!match) return null
  const [, slug, id] = match
  if (!(slug in ENTITY_SLUGS)) return null
  return { slug, id }
}

function parseFundInAmRoute(pathname: string): { amId: string; fundId: string } | null {
  const match = pathname.match(/^\/asset-manager\/([^/]+)\/fund\/([^/]+)/)
  return match ? { amId: match[1], fundId: match[2] } : null
}

const HOLDINGS_NAV = [
  { title: "Assets", href: "/assets", icon: CirclePlus },
  { title: "Liabilities", href: "/liabilities", icon: CircleMinus },
]

const HOLDINGS_WITH_CAP_NAV = [
  { title: "Assets", href: "/assets", icon: CirclePlus },
  { title: "Liabilities", href: "/liabilities", icon: CircleMinus },
  { title: "CAP Table", href: "/cap-table", icon: Table },
]

const ENTRIES_NAV = [
  { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { title: "Mutations", href: "/mutations", icon: RefreshCcw },
]

const ACTIVITY_NAV = [
  { title: "Tasks", href: "/tasks", icon: ListTodo },
  { title: "Documents", href: "/documents", icon: FileText },
]

const ASSET_MANAGER_NAV: { label: string; items: { title: string; href: string; icon: React.ElementType }[] }[] = [
  {
    label: "Transactions",
    items: [
      { title: "Mutations", href: "/mutations", icon: RefreshCcw },
      { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { title: "Profit & Loss", href: "/profit-and-loss", icon: TrendingUp },
    ],
  },
  {
    label: "Managers",
    items: [
      { title: "Funds", href: "/funds", icon: Landmark },
      { title: "Investors", href: "/investors", icon: Users2 },
      { title: "Assets", href: "/assets", icon: Briefcase },
      { title: "Compliance", href: "/compliance", icon: Shield },
    ],
  },
  {
    label: "Activity",
    items: [
      { title: "Activity", href: "/activity", icon: Activity },
      { title: "Documents", href: "/documents", icon: FileText },
      { title: "Tasks", href: "/tasks", icon: ListTodo },
    ],
  },
]

const FUND_IN_AM_HOLDINGS_NAV = [
  { title: "Assets", href: "/assets", icon: CirclePlus },
  { title: "Liabilities", href: "/liabilities", icon: CircleMinus },
]

const FUND_IN_AM_FINANCIAL_NAV = [
  { title: "Mutations", href: "/mutations", icon: RefreshCcw },
  { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { title: "Profit & Loss", href: "/profit-and-loss", icon: TrendingUp },
  { title: "Net Asset Value", href: "/net-asset-value", icon: BarChart3 },
]

const FUND_IN_AM_ACTIVITY_NAV = [
  { title: "Activity", href: "/activity", icon: Activity },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Tasks", href: "/tasks", icon: ListTodo },
]

function EntityNav({
  slug, id, entityType, netWorth, currencyCode = "EUR",
}: {
  slug: string; id: string; entityType: EntityType; netWorth: number | null; currencyCode?: string
}) {
  const pathname = usePathname()
  const base = `/${slug}/${id}`
  const holdingsNav = (entityType === "portfolio" || entityType === "family_office") ? HOLDINGS_NAV : HOLDINGS_WITH_CAP_NAV
  const isOverview = pathname === base

  function isActive(href: string) {
    const full = base + href
    return pathname === full || pathname.startsWith(full + "/")
  }

  function NavGroup({ label, items }: { label: string; items: { title: string; href: string; icon: React.ElementType }[] }) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarMenu>
          {items.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.href)}>
                <Link href={`${base}${item.href}`}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    )
  }

  const overviewLabel = entityType === "portfolio" || entityType === "fund" ? "Net Worth" : "Overview"
  const netWorthFormatted = netWorth !== null
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(netWorth)
    : "—"

  const overviewItem = (
    <>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={overviewLabel} isActive={isOverview} size="sm">
              <Link href={base}>
                <Globe className="shrink-0" />
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span>{overviewLabel}</span>
                  <span className="text-xs tabular-nums text-muted-foreground group-data-[collapsible=icon]:hidden">
                    {netWorthFormatted}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {entityType === "asset_manager" && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Cap Table" isActive={isActive("/cap-table")}>
                  <Link href={`${base}/cap-table`}>
                    <Table />
                    <span>Cap Table</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Team" isActive={isActive("/team")}>
                  <Link href={`${base}/team`}>
                    <Users />
                    <span>Team</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
          {entityType === "family_office" && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Members" isActive={isActive("/members")}>
                <Link href={`${base}/members`}>
                  <Users />
                  <span>Members</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroup>
      <SidebarSeparator />
    </>
  )

  if (entityType === "asset_manager") {
    return (
      <>
        {overviewItem}
        {ASSET_MANAGER_NAV.map((section) => (
          <React.Fragment key={section.label}>
            <NavGroup label={section.label} items={section.items} />
            <SidebarSeparator />
          </React.Fragment>
        ))}
      </>
    )
  }

  return (
    <>
      {overviewItem}
      <NavGroup label="Holdings" items={holdingsNav} />
      <SidebarSeparator />
      <NavGroup label="Entries" items={ENTRIES_NAV} />
      <SidebarSeparator />
      <NavGroup label="Activity" items={ACTIVITY_NAV} />
    </>
  )
}

function FundInAmNav({
  amId,
  fundId,
  netWorth,
  currencyCode = "EUR",
}: {
  amId: string
  fundId: string
  netWorth: number | null
  currencyCode?: string
}) {
  const pathname = usePathname()
  const base = `/asset-manager/${amId}/fund/${fundId}`
  const isOverview = pathname === base

  function isActive(href: string) {
    const full = base + href
    return pathname === full || pathname.startsWith(full + "/")
  }

  const netWorthFormatted = netWorth !== null
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(netWorth)
    : "—"

  function NavGroup({ label, items }: { label: string; items: { title: string; href: string; icon: React.ElementType }[] }) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarMenu>
          {items.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.href)}>
                <Link href={`${base}${item.href}`}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    )
  }

  return (
    <>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Net Worth" isActive={isOverview} size="sm">
              <Link href={base}>
                <Globe className="shrink-0" />
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <span>Net Worth</span>
                  <span className="text-xs tabular-nums text-muted-foreground group-data-[collapsible=icon]:hidden">
                    {netWorthFormatted}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Cap Table" isActive={isActive("/cap-table")}>
              <Link href={`${base}/cap-table`}>
                <Table />
                <span>Cap Table</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SidebarSeparator />
      <NavGroup label="Holdings" items={FUND_IN_AM_HOLDINGS_NAV} />
      <SidebarSeparator />
      <NavGroup label="Financial" items={FUND_IN_AM_FINANCIAL_NAV} />
      <SidebarSeparator />
      <NavGroup label="Activity" items={FUND_IN_AM_ACTIVITY_NAV} />
    </>
  )
}

function NavLinks({ entities }: { entities: UnifiedEntity[] }) {
  const pathname = usePathname()

  const [pinnedIds, setPinnedIds] = React.useState<string[]>([])

  React.useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(QUICK_ACCESS_KEY) ?? "[]")
      if (Array.isArray(stored)) setPinnedIds(stored)
    } catch {}
  }, [])
  const [showPicker, setShowPicker] = React.useState(false)

  function pin(id: string) {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id]
      localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(next))
      return next
    })
    setShowPicker(false)
  }

  function unpin(id: string) {
    setPinnedIds(prev => {
      const next = prev.filter(p => p !== id)
      localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(next))
      return next
    })
  }

  const pinnedEntities = pinnedIds
    .map(id => entities.find(e => e.id === id))
    .filter(Boolean) as UnifiedEntity[]

  const unpinned = entities.filter(e => !pinnedIds.includes(e.id))

  return (
    <>
      {/* Platform */}
      <SidebarGroup>
        <SidebarGroupLabel>Platform</SidebarGroupLabel>
        <SidebarMenu>
          {NAV_ITEMS.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
              >
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      {/* Documentation */}
      <SidebarGroup>
        <SidebarMenu>
          <Collapsible asChild defaultOpen={false} className="group/docs">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Documentation">
                  <BookOpen />
                  <span>Documentation</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/docs:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {DOCS_ITEMS.map(doc => (
                    <SidebarMenuSubItem key={doc.title}>
                      <SidebarMenuSubButton asChild>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <span>{doc.title}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroup>

      {/* Quick Access */}
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center justify-between pr-1">
          <span>Quick access</span>
          <button
            onClick={() => setShowPicker(v => !v)}
            className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
            title="Add to quick access"
          >
            <Plus className="size-3.5" />
          </button>
        </SidebarGroupLabel>

        {showPicker && unpinned.length > 0 && (
          <div className="mx-2 mb-2 rounded-md border bg-popover p-1 text-sm shadow-md">
            {unpinned.map(e => {
              const Icon = ENTITY_TYPE_ICONS[e.type] ?? Building2
              return (
                <button
                  key={e.id}
                  onClick={() => pin(e.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{e.name ?? "—"}</span>
                </button>
              )
            })}
          </div>
        )}
        {showPicker && unpinned.length === 0 && (
          <p className="px-3 pb-2 text-xs text-muted-foreground">All entities pinned.</p>
        )}

        <SidebarMenu>
          {pinnedEntities.length === 0 ? (
            <SidebarMenuItem>
              <span className="px-3 text-xs text-muted-foreground">
                Pin entities for quick access.
              </span>
            </SidebarMenuItem>
          ) : (
            pinnedEntities.map(e => {
              const Icon = ENTITY_TYPE_ICONS[e.type] ?? Building2
              const href = `${ENTITY_HREFS[e.type] ?? ""}/${e.id}`
              return (
                <SidebarMenuItem key={e.id}>
                  <SidebarMenuButton
                    asChild
                    tooltip={e.name ?? "—"}
                    isActive={pathname.startsWith(href)}
                  >
                    <Link href={href}>
                      <Icon />
                      <span>{e.name ?? "—"}</span>
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    onClick={() => unpin(e.id)}
                    title="Remove from quick access"
                    showOnHover
                  >
                    <X className="size-3" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              )
            })
          )}
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: CurrentUser
  entities: UnifiedEntity[]
}

export function AppSidebar({ user, entities: initialEntities, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const [entities, setEntities] = React.useState<UnifiedEntity[]>(initialEntities)

  React.useEffect(() => {
    function refresh() {
      fetch("/api/entities")
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (Array.isArray(data)) setEntities(data) })
        .catch(() => {})
    }
    window.addEventListener("entities:update", refresh)
    return () => window.removeEventListener("entities:update", refresh)
  }, [])
  const fundInAmRoute = parseFundInAmRoute(pathname)
  const entityRoute = fundInAmRoute ? null : parseEntityRoute(pathname)
  const activeEntity = entityRoute
    ? entities.find(e => e.id === entityRoute.id)
    : undefined

  // For fund-in-AM context: get net worth entity from the fund
  const netWorthEntityId = fundInAmRoute?.fundId ?? entityRoute?.id
  const netWorthEntity = entities.find(e => e.id === netWorthEntityId)
  const entityUUID = netWorthEntity?.entity
  const currencyCode = netWorthEntity?._currency?.code

  const [netWorth, setNetWorth] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!netWorthEntityId || !entityUUID) { setNetWorth(null); return }
    function fetchNetWorth() {
      const params = new URLSearchParams({ entityUUID: entityUUID! })
      if (currencyCode) params.set("baseCurrency", currencyCode)
      fetch(`/api/net-worth?${params}`)
        .then(r => r.json())
        .then(data => setNetWorth(typeof data.netWorth === "number" ? data.netWorth : null))
        .catch(() => setNetWorth(null))
    }
    fetchNetWorth()
    window.addEventListener("ledger:update", fetchNetWorth)
    return () => window.removeEventListener("ledger:update", fetchNetWorth)
  }, [netWorthEntityId, entityUUID, currencyCode])

  // For fund-in-AM context: fetch AM's funds for the switcher
  const [amFunds, setAmFunds] = React.useState<FundItem[]>([])
  React.useEffect(() => {
    if (!fundInAmRoute) { setAmFunds([]); return }
    fetch(`/api/funds?managed_by=${fundInAmRoute.amId}`)
      .then(r => r.json())
      .then((data: FundItem[]) => setAmFunds(Array.isArray(data) ? data : []))
      .catch(() => setAmFunds([]))
  }, [fundInAmRoute?.amId])

  const amName = fundInAmRoute
    ? (entities.find(e => e.id === fundInAmRoute.amId)?.name ?? null)
    : null

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {fundInAmRoute ? (
          <FundSwitcher
            amId={fundInAmRoute.amId}
            amName={amName}
            fundId={fundInAmRoute.fundId}
            funds={amFunds}
          />
        ) : (
          <EntitySwitcher entities={entities} />
        )}
      </SidebarHeader>
      <SidebarContent>
        {fundInAmRoute ? (
          <FundInAmNav
            amId={fundInAmRoute.amId}
            fundId={fundInAmRoute.fundId}
            netWorth={netWorth}
            currencyCode={currencyCode}
          />
        ) : entityRoute && activeEntity ? (
          <EntityNav
            slug={entityRoute.slug}
            id={entityRoute.id}
            entityType={ENTITY_SLUGS[entityRoute.slug]}
            netWorth={netWorth}
            currencyCode={activeEntity?._currency?.code}
          />
        ) : (
          <NavLinks entities={entities} />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
