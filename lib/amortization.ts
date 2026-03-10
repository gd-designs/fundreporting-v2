export type Period = {
  period: number
  opening: number
  payment: number
  interest: number
  principal: number
  closing: number
}

export type PaymentScheme = "linear" | "bullet" | "annuity"

export const FREQUENCY_PERIODS: Record<string, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  "bi-annually": 2,
  annually: 1,
}

export function computeLinear(p: number, r: number, freq: string, numPeriods: number): Period[] {
  const n = numPeriods
  const rate = r / 100 / (FREQUENCY_PERIODS[freq] ?? 1)
  const principalPer = p / n
  const result: Period[] = []
  let opening = p
  for (let i = 1; i <= n; i++) {
    const interest = opening * rate
    const closing = Math.max(0, opening - principalPer)
    result.push({ period: i, opening, payment: principalPer + interest, interest, principal: principalPer, closing })
    opening = closing
  }
  return result
}

export function computeBullet(p: number, r: number, freq: string, numPeriods: number): Period[] {
  const n = numPeriods
  const rate = r / 100 / (FREQUENCY_PERIODS[freq] ?? 1)
  return Array.from({ length: n }, (_, idx) => {
    const i = idx + 1
    const isLast = i === n
    const interest = p * rate
    return { period: i, opening: p, payment: interest + (isLast ? p : 0), interest, principal: isLast ? p : 0, closing: isLast ? 0 : p }
  })
}

export function computeAnnuity(p: number, r: number, freq: string, numPeriods: number): Period[] {
  const n = numPeriods
  const rate = r / 100 / (FREQUENCY_PERIODS[freq] ?? 1)
  const pmt = rate === 0 ? p / n : (p * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)
  const result: Period[] = []
  let opening = p
  for (let i = 1; i <= n; i++) {
    const interest = opening * rate
    const principal = pmt - interest
    const closing = Math.max(0, opening - principal)
    result.push({ period: i, opening, payment: pmt, interest, principal, closing })
    opening = closing
  }
  return result
}

export function computeAll(p: number, r: number, freq: string, numPeriods: number): Record<PaymentScheme, Period[]> {
  return {
    linear: computeLinear(p, r, freq, numPeriods),
    bullet: computeBullet(p, r, freq, numPeriods),
    annuity: computeAnnuity(p, r, freq, numPeriods),
  }
}

export function fmtNum(v: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)
}
