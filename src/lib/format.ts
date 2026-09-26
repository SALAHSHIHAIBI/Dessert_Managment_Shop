import type { PaymentMethod, PurchaseCategory, StockReason } from '@/generated/prisma/enums'

export const CATEGORY_LABELS: Record<PurchaseCategory, string> = {
  INGREDIENTS: 'Ingredients',
  EQUIPMENT: 'Equipment',
  PACKAGING: 'Packaging',
  RENT: 'Rent',
  UTILITIES: 'Utilities',
  TRANSPORT: 'Transport',
  SALARIES: 'Salaries',
  OTHER: 'Other',
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  CREDIT: 'On credit',
}

export const STOCK_REASON_LABELS: Record<StockReason, string> = {
  PURCHASE: 'Purchase',
  PRODUCTION_INPUT: 'Used in baking',
  PRODUCTION_OUTPUT: 'Made',
  SALE: 'Sold',
  ADJUSTMENT: 'Adjustment',
  WASTE: 'Waste',
}

/** "18 Sep 2026" — unambiguous, unlike a numeric date. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)}, ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/** Value for an <input type="date">, in the machine format it requires. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

/**
 * Read a date from a form. Dates entered here are calendar days, so they are
 * stored at midday UTC — far enough from either midnight that a timezone shift
 * can never move a purchase to the day before or after.
 */
export function parseDateInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) throw new Error(`Not a valid date: ${value}`)
  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12))
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
