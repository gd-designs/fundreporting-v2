"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type DataPoint = { label: string; value: number }

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value)
}

export function PortfolioTrendChart({
  data,
  assetsHref,
}: {
  data: DataPoint[]
  assetsHref: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Portfolio trend</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link href={assetsHref}>
            Manage assets
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) =>
                new Intl.NumberFormat("en-GB", {
                  notation: "compact",
                  maximumFractionDigits: 0,
                }).format(v)
              }
              width={72}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), "Net Worth"]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              fill="url(#netWorthGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
