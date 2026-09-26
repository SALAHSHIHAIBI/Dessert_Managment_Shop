import 'server-only'

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { StockReason } from '@/generated/prisma/enums'

// Stock is never stored as a single number that gets overwritten. It is the sum
// of every StockLog row for an item, so any level on screen can be traced back
// to the purchase, batch, sale or adjustment that caused it.

export type Tx = Prisma.TransactionClient

/** Current stock per ingredient, in milli-units. Missing ids mean zero. */
export async function getIngredientStock(ingredientIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.stockLog.groupBy({
    by: ['ingredientId'],
    _sum: { delta: true },
    where: ingredientIds
      ? { ingredientId: { in: ingredientIds } }
      : { ingredientId: { not: null } },
  })
  return toMap(rows.map((r) => [r.ingredientId, r._sum.delta]))
}

/** Current stock per dessert, in pieces. Missing ids mean zero. */
export async function getDessertStock(dessertIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.stockLog.groupBy({
    by: ['dessertId'],
    _sum: { delta: true },
    where: dessertIds ? { dessertId: { in: dessertIds } } : { dessertId: { not: null } },
  })
  return toMap(rows.map((r) => [r.dessertId, r._sum.delta]))
}

function toMap(pairs: Array<[string | null, number | null]>): Map<string, number> {
  const map = new Map<string, number>()
  for (const [id, sum] of pairs) {
    if (id) map.set(id, sum ?? 0)
  }
  return map
}

/**
 * Stock changes a purchase should produce: one entry per item that is linked to
 * an ingredient. Unlinked items are pure bookkeeping and move no stock.
 *
 * Call inside the same transaction that writes the purchase.
 */
export async function syncPurchaseStock(tx: Tx, purchaseId: string): Promise<void> {
  // Rewrite rather than patch: on an edit the old entries are dropped and the
  // current items are re-applied, so stock always matches what the purchase says.
  await tx.stockLog.deleteMany({ where: { purchaseId } })

  const purchase = await tx.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: true },
  })
  if (!purchase) return

  const linked = purchase.items.filter((item) => item.ingredientId && item.quantity !== 0)
  if (linked.length === 0) return

  await tx.stockLog.createMany({
    data: linked.map((item) => ({
      at: purchase.date,
      ingredientId: item.ingredientId,
      delta: item.quantity,
      reason: StockReason.PURCHASE,
      purchaseId,
      note: item.description,
    })),
  })
}

export type ProductionInput = {
  dessertId: string
  quantity: number
  date: Date
  notes?: string | null
}

export type ProductionResult = {
  productionId: string
  /** Ingredients that went negative, so the screen can warn about them. */
  shortages: Array<{ ingredientId: string; name: string; shortBy: number }>
}

/**
 * Record a baking run: the dessert's recipe is multiplied by the number of
 * pieces made, those ingredients come out of stock, and the pieces go in.
 * A run is never blocked — a shortage is reported so it can be corrected.
 */
export async function recordProduction(input: ProductionInput): Promise<ProductionResult> {
  if (input.quantity <= 0) throw new Error('Quantity made must be greater than zero.')

  return prisma.$transaction(async (tx) => {
    const dessert = await tx.dessert.findUnique({
      where: { id: input.dessertId },
      include: { recipeLines: { include: { ingredient: true } } },
    })
    if (!dessert) throw new Error('That dessert no longer exists.')

    const production = await tx.production.create({
      data: {
        dessertId: dessert.id,
        quantity: input.quantity,
        date: input.date,
        notes: input.notes ?? null,
      },
    })

    const consumed = dessert.recipeLines
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        amount: line.quantity * input.quantity,
      }))

    await tx.stockLog.createMany({
      data: [
        {
          at: input.date,
          dessertId: dessert.id,
          delta: input.quantity,
          reason: StockReason.PRODUCTION_OUTPUT,
          productionId: production.id,
        },
        ...consumed.map((c) => ({
          at: input.date,
          ingredientId: c.ingredientId,
          delta: -c.amount,
          reason: StockReason.PRODUCTION_INPUT,
          productionId: production.id,
          note: `Used making ${dessert.name}`,
        })),
      ],
    })

    const shortages = await findShortages(
      tx,
      consumed.map((c) => ({ ingredientId: c.ingredientId, name: c.name })),
    )
    return { productionId: production.id, shortages }
  })
}

export type SaleInput = {
  date: Date
  notes?: string | null
  lines: Array<{ dessertId: string; quantity: number; unitPriceDirhams: number }>
}

/**
 * Record a sale and take the pieces out of dessert stock, in one transaction so
 * the two can never disagree.
 */
export async function recordSale(input: SaleInput): Promise<{ saleId: string }> {
  const lines = input.lines.filter((line) => line.quantity > 0)
  if (lines.length === 0) throw new Error('A sale needs at least one dessert.')

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        date: input.date,
        notes: input.notes ?? null,
        lines: { create: lines },
      },
    })

    await tx.stockLog.createMany({
      data: lines.map((line) => ({
        at: input.date,
        dessertId: line.dessertId,
        delta: -line.quantity,
        reason: StockReason.SALE,
        saleId: sale.id,
      })),
    })

    return { saleId: sale.id }
  })
}

/** A manual correction or a write-off. `delta` is signed. */
export async function recordAdjustment(input: {
  ingredientId?: string
  dessertId?: string
  delta: number
  reason: typeof StockReason.ADJUSTMENT | typeof StockReason.WASTE
  note?: string | null
}): Promise<void> {
  if (!input.ingredientId === !input.dessertId) {
    throw new Error('An adjustment applies to either an ingredient or a dessert, not both.')
  }
  if (input.delta === 0) throw new Error('An adjustment of zero changes nothing.')

  await prisma.stockLog.create({
    data: {
      ingredientId: input.ingredientId ?? null,
      dessertId: input.dessertId ?? null,
      delta: input.delta,
      reason: input.reason,
      note: input.note ?? null,
    },
  })
}

async function findShortages(
  tx: Tx,
  ingredients: Array<{ ingredientId: string; name: string }>,
): Promise<Array<{ ingredientId: string; name: string; shortBy: number }>> {
  if (ingredients.length === 0) return []
  const rows = await tx.stockLog.groupBy({
    by: ['ingredientId'],
    _sum: { delta: true },
    where: { ingredientId: { in: ingredients.map((i) => i.ingredientId) } },
  })
  const levels = toMap(rows.map((r) => [r.ingredientId, r._sum.delta]))
  return ingredients
    .map((i) => ({ ...i, shortBy: -(levels.get(i.ingredientId) ?? 0) }))
    .filter((i) => i.shortBy > 0)
}
