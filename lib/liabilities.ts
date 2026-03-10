export type Liability = {
  id: string
  name: string | null
  description?: string | null
  notes?: string | null
  entity: string
  asset?: string | null
  loan_amount?: number | null
  interest_rate?: number | null
  frequency?: string | null
  term_length?: number | null
  scheme?: string | null
  reference?: string | null
  date?: number | null
  created_at: number
}

export async function fetchEntityLiabilities(entityUUID: string): Promise<Liability[]> {
  const res = await fetch(`/api/liabilities?entity=${entityUUID}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch liabilities")
  return res.json()
}

export function termUnitLabel(frequency: string | null | undefined): string {
  switch (frequency) {
    case "daily": return "days"
    case "weekly": return "weeks"
    case "monthly": return "months"
    case "quarterly": return "quarters"
    case "bi-annually": return "half-years"
    case "annually": return "years"
    default: return "periods"
  }
}

export function frequencyLabel(frequency: string | null | undefined): string {
  switch (frequency) {
    case "daily": return "Daily"
    case "weekly": return "Weekly"
    case "monthly": return "Monthly"
    case "quarterly": return "Quarterly"
    case "bi-annually": return "Bi-annually"
    case "annually": return "Annually"
    default: return frequency ?? "—"
  }
}
