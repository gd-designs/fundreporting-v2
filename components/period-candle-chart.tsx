"use client"

import * as React from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LedgerSeriesPoint, LedgerEventMarker } from "@/lib/period-ledger"

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const BLUE = "#3b82f6"     // balance (in-fund value)
const GREEN = "#10b981"    // cumulative wealth (balance + distributions)
const RED = "#ef4444"      // capital base (net subscriptions)

export function PeriodCandleChart({
  series,
  events,
  latestPeriodStart,
}: {
  series: LedgerSeriesPoint[]
  events: LedgerEventMarker[]
  latestPeriodStart: number | null
}) {
  const [timeRange, setTimeRange] = React.useState("all")

  const filteredSeries = React.useMemo(() => {
    if (series.length === 0 || timeRange === "all") return series
    const latest = series[series.length - 1]?.date ?? 0
    if (timeRange === "year") {
      const start = latest - 365 * 24 * 60 * 60 * 1000
      return series.filter((p) => p.date >= start)
    }
    if (timeRange === "period") {
      if (latestPeriodStart == null) return series
      return series.filter((p) => p.date >= latestPeriodStart)
    }
    return series
  }, [series, timeRange, latestPeriodStart])

  const filteredEvents = React.useMemo(() => {
    if (events.length === 0 || timeRange === "all") return events
    const latest = series[series.length - 1]?.date ?? 0
    if (timeRange === "year") {
      const start = latest - 365 * 24 * 60 * 60 * 1000
      return events.filter((e) => e.date >= start)
    }
    if (timeRange === "period") {
      if (latestPeriodStart == null) return events
      return events.filter((e) => e.date >= latestPeriodStart)
    }
    return events
  }, [events, timeRange, latestPeriodStart, series])

  const [yMin, yMax] = React.useMemo(() => {
    const values: number[] = []
    for (const p of filteredSeries) values.push(p.capital, p.balance, p.cumValue)
    for (const e of filteredEvents) values.push(e.balance)
    if (values.length === 0) return [0, 100] as const
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(1, max - min)
    const pad = span * 0.1
    return [Math.max(0, min - pad), max + pad] as const
  }, [filteredSeries, filteredEvents])

  if (filteredSeries.length === 0) {
    return <p className="text-muted-foreground text-sm">No closed periods to display yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="h-8 w-33 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="all" className="text-xs">Full history</SelectItem>
            <SelectItem value="year" className="text-xs">Last year</SelectItem>
            <SelectItem value="period" className="text-xs">Last period</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={filteredSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BLUE} stopOpacity={0.28} />
              <stop offset="95%" stopColor={BLUE} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
            minTickGap={32}
            tickFormatter={(value: number) =>
              new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            }
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null
              const datum = payload[0]?.payload as LedgerSeriesPoint | undefined
              if (!datum) return null
              return (
                <div className="rounded-md border bg-card text-card-foreground p-2 text-xs shadow-sm space-y-0.5">
                  {datum.label && <div className="font-medium">{datum.label}</div>}
                  <div>
                    <span className="inline-block size-2 rounded-full mr-1.5" style={{ background: BLUE }} />
                    Balance: {formatAmount(datum.balance)}
                  </div>
                  <div>
                    <span className="inline-block size-2 rounded-full mr-1.5" style={{ background: GREEN }} />
                    Cum. wealth: {formatAmount(datum.cumValue)}
                  </div>
                  <div>
                    <span className="inline-block size-2 rounded-full mr-1.5" style={{ background: RED }} />
                    Capital: {formatAmount(datum.capital)}
                  </div>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={BLUE}
            strokeWidth={2}
            fill="url(#balanceFill)"
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="cumValue"
            stroke={GREEN}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            type="stepAfter"
            dataKey="capital"
            stroke={RED}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <Legend swatch={BLUE} label="Balance (in-fund value)" />
        <Legend swatch={GREEN} label="Cumulative wealth" />
        <Legend swatch={RED} label="Capital base" />
      </div>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ background: swatch }} />
      {label}
    </span>
  )
}
