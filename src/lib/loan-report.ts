import 'server-only'

import { prisma } from '@/lib/prisma'
import type { PurchaseCategory } from '@/generated/prisma/enums'

export type ReportRange = { from: Date | null; to: Date | null }

export type ReportPurchase = {
  id: string
  date: Date
  supplierName: string | null
  category: PurchaseCategory
  paymentMethod: string
  totalDirhams: number
  notes: string | null
  items: Array<{ description: string; quantity: number; unitPriceDirhams: number }>
  receipts: Array<{ id: string; mimeType: string; fileName: string | null }>
}

export type LoanReport = {
  range: ReportRange
  purchases: ReportPurchase[]
  totalDirhams: number
  byCategory: Array<{ category: PurchaseCategory; count: number; totalDirhams: number }>
  receiptCount: number
  missingReceiptCount: number
}

/** Turns `?from=` / `?to=` into a range. Either end may be left open. */
export function parseRange(from?: string | null, to?: string | null): ReportRange {
  const parse = (value: string | null | undefined, endOfDay: boolean) => {
    if (!value) return null
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return null
    const [, year, month, day] = match
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), endOfDay ? 23 : 0, endOfDay ? 59 : 0, 59),
    )
  }
  return { from: parse(from, false), to: parse(to, true) }
}

/**
 * Everything the loan file needs, in one shape. The page on screen, the PDF,
 * the Excel file and the shared link all read from here, so they can never
 * disagree about what was spent.
 */
export async function buildLoanReport(range: ReportRange): Promise<LoanReport> {
  const where = {
    forLoan: true,
    ...(range.from || range.to
      ? {
          date: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {}),
  }

  const purchases = await prisma.purchase.findMany({
    where,
    orderBy: { date: 'asc' },
    include: {
      items: { select: { description: true, quantity: true, unitPriceDirhams: true } },
      receipts: { select: { id: true, mimeType: true, fileName: true } },
    },
  })

  const byCategoryMap = new Map<PurchaseCategory, { count: number; totalDirhams: number }>()
  let totalDirhams = 0
  let receiptCount = 0
  let missingReceiptCount = 0

  for (const purchase of purchases) {
    totalDirhams += purchase.totalDirhams
    receiptCount += purchase.receipts.length
    if (purchase.receipts.length === 0) missingReceiptCount += 1

    const entry = byCategoryMap.get(purchase.category) ?? { count: 0, totalDirhams: 0 }
    entry.count += 1
    entry.totalDirhams += purchase.totalDirhams
    byCategoryMap.set(purchase.category, entry)
  }

  return {
    range,
    purchases,
    totalDirhams,
    byCategory: [...byCategoryMap.entries()]
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.totalDirhams - a.totalDirhams),
    receiptCount,
    missingReceiptCount,
  }
}

/** Receipt images for the PDF, loaded only when they are actually needed. */
export async function loadReceiptImages(
  ids: string[],
): Promise<Map<string, { data: Uint8Array; mimeType: string }>> {
  if (ids.length === 0) return new Map()
  const receipts = await prisma.receipt.findMany({
    where: { id: { in: ids }, mimeType: { startsWith: 'image/' } },
    select: { id: true, data: true, mimeType: true },
  })
  return new Map(receipts.map((r) => [r.id, { data: r.data, mimeType: r.mimeType }]))
}
