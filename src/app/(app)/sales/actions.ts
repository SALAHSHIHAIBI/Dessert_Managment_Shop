'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordSale } from '@/lib/stock'
import { parseDateInput } from '@/lib/format'
import { dinarsToDirhams } from '@/lib/units'

/** `saleId` identifies the sale that just went through, so the counter screen
 *  can tell a fresh success from the one it has already cleared for. */
export type SaleState = { error?: string; ok?: string; saleId?: string }

export async function addSale(_prev: SaleState, formData: FormData): Promise<SaleState> {
  await requireSession()

  try {
    const dessertIds = formData.getAll('lineDessertId').map(String)
    const quantities = formData.getAll('lineQuantity').map(String)
    const prices = formData.getAll('lineUnitPrice').map(String)

    const lines = dessertIds
      .map((dessertId, index) => ({
        dessertId,
        quantity: Math.round(Number(quantities[index] ?? '0')),
        unitPriceDirhams: dinarsToDirhams(prices[index] ?? '0'),
      }))
      .filter((line) => line.dessertId && line.quantity > 0)

    if (lines.length === 0) throw new Error('Tap a dessert to add it to the sale.')

    const dateValue = String(formData.get('date') ?? '')
    const { saleId } = await recordSale({
      // A sale entered without a date is happening now, so keep the real time.
      date: dateValue ? parseDateInput(dateValue) : new Date(),
      notes: String(formData.get('notes') ?? '').trim() || null,
      lines,
    })

    revalidatePath('/sales')
    revalidatePath('/inventory')
    revalidatePath('/')

    const pieces = lines.reduce((sum, line) => sum + line.quantity, 0)
    return { ok: `Sale recorded — ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}.`, saleId }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not record that sale.' }
  }
}

export async function deleteSale(formData: FormData) {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  // Deleting the sale removes its stock entries too, so the pieces come back.
  await prisma.sale.delete({ where: { id } })
  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/')
}
