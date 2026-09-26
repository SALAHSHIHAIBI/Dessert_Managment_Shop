// Money and quantity conversions.
//
// Money never touches a floating point number in storage: it is kept as whole
// dirhams, where 100 dirham = 1 Libyan dinar.
//
// Ingredient quantities are kept as whole thousandths of the ingredient's own
// unit ("milli-units"), so 2.5 kg is stored as 2500 when the unit is KG. That
// gives three decimal places of precision with exact integer arithmetic.

import type { Unit } from '@/generated/prisma/enums'

export const DIRHAMS_PER_DINAR = 100
export const MILLI = 1000

/** "12.50" (as typed by the user, in dinars) -> 1250 dirhams. */
export function dinarsToDirhams(input: string | number): number {
  const dinars = typeof input === 'number' ? input : Number(input.trim().replace(',', '.'))
  if (!Number.isFinite(dinars)) {
    throw new Error(`Not a valid amount: ${input}`)
  }
  return Math.round(dinars * DIRHAMS_PER_DINAR)
}

/** 1250 dirhams -> "12.50". Always two decimals, no currency name. */
export function formatDirhams(dirhams: number): string {
  const negative = dirhams < 0
  const abs = Math.abs(Math.round(dirhams))
  const dinars = Math.floor(abs / DIRHAMS_PER_DINAR)
  const rest = abs % DIRHAMS_PER_DINAR
  const body = `${dinars.toLocaleString('en-US')}.${String(rest).padStart(2, '0')}`
  return negative ? `-${body}` : body
}

/** 1250 dirhams -> "12.50 LYD". */
export function formatMoney(dirhams: number): string {
  return `${formatDirhams(dirhams)} LYD`
}

/** "2.5" -> 2500 milli-units. */
export function toMilli(input: string | number): number {
  const value = typeof input === 'number' ? input : Number(input.trim().replace(',', '.'))
  if (!Number.isFinite(value)) {
    throw new Error(`Not a valid quantity: ${input}`)
  }
  return Math.round(value * MILLI)
}

/** 2500 milli-units -> "2.5". Trailing zeros are trimmed. */
export function fromMilli(milli: number): string {
  const negative = milli < 0
  const abs = Math.abs(Math.round(milli))
  const whole = Math.floor(abs / MILLI)
  const rest = abs % MILLI
  const body =
    rest === 0
      ? String(whole)
      : `${whole}.${String(rest).padStart(3, '0').replace(/0+$/, '')}`
  return negative ? `-${body}` : body
}

const UNIT_LABELS: Record<Unit, string> = {
  KG: 'kg',
  G: 'g',
  L: 'L',
  ML: 'ml',
  PIECE: 'pcs',
}

export function unitLabel(unit: Unit): string {
  return UNIT_LABELS[unit]
}

/** 2500 milli-units of a KG ingredient -> "2.5 kg". */
export function formatQuantity(milli: number, unit: Unit): string {
  return `${fromMilli(milli)} ${unitLabel(unit)}`
}

/** Dessert stock and sales are whole pieces, so they need no scaling. */
export function formatPieces(pieces: number): string {
  return `${pieces.toLocaleString('en-US')} ${pieces === 1 ? 'piece' : 'pieces'}`
}
