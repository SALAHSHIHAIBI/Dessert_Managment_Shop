'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordProduction } from '@/lib/stock'
import { parseDateInput } from '@/lib/format'
import { formatQuantity } from '@/lib/units'

export type ProductionState = { error?: string; ok?: string; warning?: string }

export async function addProduction(
  _prev: ProductionState,
  formData: FormData,
): Promise<ProductionState> {
  await requireSession()

  try {
    const dessertId = String(formData.get('dessertId') ?? '')
    if (!dessertId) throw new Error('Choose which dessert you made.')

    const quantity = Math.round(Number(String(formData.get('quantity') ?? '')))
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Enter how many pieces you made.')
    }

    const result = await recordProduction({
      dessertId,
      quantity,
      date: parseDateInput(String(formData.get('date') ?? '')),
      notes: String(formData.get('notes') ?? '').trim() || null,
    })

    revalidatePath('/production')
    revalidatePath('/inventory')
    revalidatePath('/sales')
    revalidatePath('/')

    if (result.shortages.length > 0) {
      // The run is still recorded — a negative level means a purchase was
      // probably never entered, and hiding that would not make it less true.
      const units = await prisma.ingredient.findMany({
        where: { id: { in: result.shortages.map((s) => s.ingredientId) } },
        select: { id: true, unit: true },
      })
      const unitById = new Map(units.map((u) => [u.id, u.unit]))
      const list = result.shortages
        .map((s) => `${s.name} (short by ${formatQuantity(s.shortBy, unitById.get(s.ingredientId)!)})`)
        .join(', ')
      return {
        ok: `Recorded ${quantity} pieces.`,
        warning: `Your stock now shows less than zero for: ${list}. Check whether a purchase is missing.`,
      }
    }

    return { ok: `Recorded ${quantity} pieces.` }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not record that batch.' }
  }
}

export async function deleteProduction(formData: FormData) {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  // Its stock entries go with it, so ingredients and pieces both come back.
  await prisma.production.delete({ where: { id } })
  revalidatePath('/production')
  revalidatePath('/inventory')
  revalidatePath('/')
}
