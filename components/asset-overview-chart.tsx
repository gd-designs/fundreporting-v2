"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatAmountWithCurrency, formatTxDate } from "@/lib/entity-transactions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type OverviewRow = {
  date: number
  balance: number
  label?: string
  realizedGain?: number | null
}

type ChartPoint = {
  date: string
  timestamp: number
  label: string
  balance: number
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function buildChartData(rows: OverviewRow[]): ChartPoint[] {
  return rows
    .map((row) => ({
      date: new Date(row.date).toISOString(),
      timestamp: row.date,
      label: row.label || formatTxDate(row.date),
      balance: row.balance,
    }))
}

function RealizedGainBadge({ gain }: { gain: number }) {
  const isPositive = gain >= 0
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isPositive
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
      }`}
    >
      {isPositive ? "+" : "−"}
      {formatAmount(Math.abs(gain))} realized {isPositive ? "gain" : "loss"}
    </span>
  )
}

export function AssetOverviewChart({ rows }: { rows: OverviewRow[] }) {
  const [timeRange, setTimeRange] = React.useState("all")
  const chartData = buildChartData(rows)
  const filteredData = React.useMemo(() => {
    if (chartData.length === 0 || timeRange === "all") return chartData
    const latest = chartData[chartData.length - 1]?.timestamp ?? 0
    const daysToSubtract = timeRange === "30d" ? 30 : 7
    const start = latest - daysToSubtract * 24 * 60 * 60 * 1000
    return chartData.filter((point) => point.timestamp >= start)
  }, [chartData, timeRange])

  const [yMin, yMax, trendUp] = React.useMemo(() => {
    if (filteredData.length === 0) return [0, 100, true] as const
    const values = filteredData.map((point) => point.balance)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(1, max - min)
    const pad = span * 0.15
    const start = filteredData[0]?.balance ?? 0
    const end = filteredData[filteredData.length - 1]?.balance ?? 0
    return [min - pad, max + pad, end >= start] as const
  }, [filteredData])

  const realizedGain = rows.reduce<number | null>((acc, row) => {
    if (row.realizedGain == null) return acc
    return (acc ?? 0) + row.realizedGain
  }, null)

  if (chartData.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        No transaction history to display.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {realizedGain != null ? (
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-xs">Realized P&L</p>
            <RealizedGainBadge gain={realizedGain} />
          </div>
        ) : (
          <div />
        )}
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="h-8 w-33 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="all" className="text-xs">Full history</SelectItem>
            <SelectItem value="30d" className="text-xs">Last 30 days</SelectItem>
            <SelectItem value="7d" className="text-xs">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={filteredData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={trendUp ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"}
                stopOpacity={0.34}
              />
              <stop
                offset="95%"
                stopColor={trendUp ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"}
                stopOpacity={0.03}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
            minTickGap={24}
            tickFormatter={(value: string, index: number) => {
              const point = filteredData[index]
              const dateLabel = new Date(value).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })
              const label = point?.label ?? ""
              const tag = label.includes("·") ? label.split("·")[1]?.trim() : ""
              return tag ? `${dateLabel} · ${tag}` : dateLabel
            }}
          />
          <YAxis
            tickFormatter={(v: number) => formatAmount(v)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={80}
            className="fill-muted-foreground"
            domain={[yMin, yMax]}
          />
          <Tooltip
            labelFormatter={(_: unknown, payload: unknown[]) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (payload as any[])?.[0]?.payload?.label ?? ""
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [
              formatAmount(typeof value === "number" ? value : Number(value ?? 0)),
              "Balance",
            ]}
            contentStyle={{
              borderRadius: "6px",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              fontSize: 12,
            }}
          />
          <Area
            type="natural"
            dataKey="balance"
            stroke={trendUp ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"}
            strokeWidth={2.25}
            fill="url(#balanceGradient)"
            dot={{ r: 2 }}
            activeDot={{ r: 4.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
