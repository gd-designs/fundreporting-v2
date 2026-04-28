import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod/v4"

const MappingSchema = z.object({
  headerRowIndex: z.number().describe("0-indexed row where column headers appear. If no clear header row (data-only file), return -1."),
  dataStartIndex: z.number().describe("0-indexed first row of actual transaction data. Usually headerRowIndex + 1."),
  detectedBank: z.string().describe("Short description of detected format, e.g. 'Citibank NL statement', 'ING CSV', 'Generic CSV'"),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD.MM.YYYY", "auto"]).describe("Date format used in the date column. Use 'auto' only if you cannot tell."),
  currency: z.string().nullable().describe("Detected currency code like EUR, USD, GBP if inferable from data, else null"),
  columnMapping: z.object({
    date: z.number().nullable().describe("0-indexed column with the transaction date"),
    reference: z.number().nullable().describe("0-indexed column with the description/reference/memo/narrative"),
    amount: z.number().nullable().describe("0-indexed column with a single signed amount. Null if the file uses separate credit/debit columns."),
    credit: z.number().nullable().describe("0-indexed column with credit (money in). Null if a single signed amount column is used."),
    debit: z.number().nullable().describe("0-indexed column with debit (money out). Null if a single signed amount column is used."),
    balance: z.number().nullable().describe("0-indexed column with running balance. Null if absent."),
    direction: z.number().nullable().describe("0-indexed column with explicit direction (DR/CR, +/-, in/out). Null if absent."),
    senderCounterparty: z.number().nullable().describe("0-indexed column with sender/counterparty name. Null if absent."),
  }),
  skipRowPatterns: z.array(z.string()).describe("Case-insensitive text fragments that identify non-transaction rows to exclude, e.g. ['Opening Balance', 'Closing Balance', 'Subtotal', 'Period Totals']. Empty array if none."),
  notes: z.string().nullable().describe("Warnings, caveats, or assumptions. Null if none."),
})

const SYSTEM_PROMPT = `You are a bank transaction file analyzer. Given a raw 2D grid of a CSV or Excel export (no assumed header row), identify:

1. The row index where actual column headers live (not letterhead, account summary, or filler rows).
2. The column positions (0-indexed) of: date, reference/description, amount OR separate credit/debit, balance, direction, sender/counterparty.
3. The date format used.
4. Text patterns identifying non-transaction rows to exclude (Opening Balance, Closing Balance, subtotals, filler rows with id='-' etc).

## Critical rules

- The first N rows (often 5-20) may be metadata/letterhead/account info — NOT headers. Find the ACTUAL header row by looking for recognizable financial column names like DATE, AMOUNT, DESCRIPTION, BALANCE, CREDIT, DEBIT, REFERENCE.
- Many European bank files (Dutch, German, French) use separate CREDIT and DEBIT columns. Where one is 0 / empty, the other has the amount. If that's the case: set \`amount\` to null and populate \`credit\` and \`debit\` with their column indices.
- Some files have currency columns interspersed after credit/debit/balance (labeled "EUR" or "USD" as actual row values). These are redundant — ignore them, but still return the correct indices for the numeric columns.
- Opening/Closing Balance rows are synthetic. Detect them by patterns like id='-' or reference text containing "Opening Balance" / "Closing Balance".
- Dates: DD/MM/YYYY is common in Europe, MM/DD/YYYY in the US, YYYY-MM-DD in ISO. Infer from the values you see — e.g. "31/12/2024" must be DD/MM/YYYY because 31 can't be a month.
- If you can't determine a field confidently, return null for it (the user will map it manually).

## Example: Citibank NL format

Rows 0-16 contain letterhead (bank name, account holder, IBAN, period summary). Row 17 has headers: DATE, ID, SENDER, REFERENCE, CREDIT, (EUR), DEBIT, (EUR), BALANCE, (EUR). Data starts at row 18. First and last data rows are Opening/Closing Balance with id='-'. Dates are DD/MM/YYYY. Credit/debit are separate columns.

Expected output for this format:
- headerRowIndex: 17
- dataStartIndex: 18
- columnMapping: { date: 0, reference: 3, credit: 4, debit: 6, balance: 8, senderCounterparty: 2, amount: null, direction: null }
- dateFormat: "DD/MM/YYYY"
- skipRowPatterns: ["Opening Balance", "Closing Balance"]

## Another example: generic signed-amount CSV

Headers at row 0: Date, Description, Amount, Balance. Amount column has negative values for debits and positive for credits.

Expected output:
- headerRowIndex: 0
- dataStartIndex: 1
- columnMapping: { date: 0, reference: 1, amount: 2, balance: 3, credit: null, debit: null }
- dateFormat: inferred from actual values
- skipRowPatterns: []

Be precise. The mapping will be applied deterministically to parse thousands of rows.`

export async function POST(req: NextRequest) {
  try {
    const { grid, fileName } = (await req.json()) as { grid: string[][]; fileName?: string }

    if (!Array.isArray(grid) || grid.length === 0) {
      return NextResponse.json({ error: "grid is required" }, { status: 400 })
    }

    // Sample first 40 rows — enough to catch late header rows (Citibank has them at 17)
    const sample = grid.slice(0, 40)

    const client = new Anthropic()

    const userMessage =
      `File: ${fileName ?? "(unknown)"}\n\n` +
      `Raw grid (first ${sample.length} rows, each row is an array of cell values in column order):\n\n` +
      sample.map((row, i) => `${i}: ${JSON.stringify(row)}`).join("\n") +
      `\n\nAnalyze this grid and return the header location, column mapping, date format, and any rows to skip.`

    const response = await client.messages.parse({
      model: "claude-opus-4-6",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
      output_config: {
        // Anthropic SDK's helper uses zod v4 internally; our schema is v4 but
        // the helper's .d.ts is typed against v3 ZodType — cast to satisfy TS.
        format: zodOutputFormat(MappingSchema as unknown as Parameters<typeof zodOutputFormat>[0]),
      },
    })

    const parsed = response.parsed_output
    if (!parsed) {
      return NextResponse.json({ error: "Model returned no structured output" }, { status: 502 })
    }

    return NextResponse.json({
      mapping: parsed,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read: response.usage.cache_read_input_tokens ?? 0,
        cache_create: response.usage.cache_creation_input_tokens ?? 0,
      },
    })
  } catch (e) {
    console.error("[import-transactions-analyze] error:", e)
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
