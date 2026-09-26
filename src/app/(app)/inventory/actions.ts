'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAdjustment } from '@/lib/stock'
import { dinarsToDirhams, toMilli } from '@/lib/units'
import { StockReason, Unit } from '@/generated/prisma/enums'

export type ActionState = { error?: string; ok?: string }

function revalidateInventory() {
  revalidatePath('/inventory')
  revalidatePath('/recipes')
  revalidatePath('/')
}

export async function createIngredient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession()
  try {
    const name = String(formData.get('name') ?? '').trim()
    if (!name) throw new Error('Give the ingredient a name.')

    const unit = String(formData.get('unit') ?? '') as Unit
    if (!(unit in Unit)) throw new Error('Choose a unit.')

    const reorderRaw = String(formData.get('reorderLevel') ?? '').trim()
    const openingRaw = String(formData.get('openingStock') ?? '').trim()

    const ingredient = await prisma.ingredient.create({
      data: { name, unit, reorderLevel: reorderRaw ? toMilli(reorderRaw) : 0 },
    })

    // An opening balance is recorded as an adjustment, so it shows up in the
    // history like every other change rather than appearing from nowhere.
    if (openingRaw) {
      const opening = toMilli(openingRaw)
      if (opening !== 0) {
        await recordAdjustment({
          ingredientId: ingredient.id,
          delta: opening,
          reason: StockReason.ADJUSTMENT,
          note: 'Opening stock',
        })
      }
    }

    revalidateInventory()
    return { ok: `${name} added.` }
  } catch (error) {
    return { error: describe(error, 'ingredient') }
  }
}

export async function createDessert(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession()
  try {
    const name = String(formData.get('name') ?? '').trim()
    if (!name) throw new Error('Give the dessert a name.')

    const priceDirhams = dinarsToDirhams(String(formData.get('price') ?? '0'))
    if (priceDirhams <= 0) throw new Error('Set a selling price above zero.')

    const reorderRaw = String(formData.get('reorderLevel') ?? '').trim()
    const openingRaw = String(formData.get('openingStock') ?? '').trim()

    const dessert = await prisma.dessert.create({
      data: {
        name,
        priceDirhams,
        reorderLevel: reorderRaw ? Math.round(Number(reorderRaw)) : 0,
      },
    })

    if (openingRaw) {
      const opening = Math.round(Number(openingRaw))
      if (opening !== 0) {
        await recordAdjustment({
          dessertId: dessert.id,
          delta: opening,
          reason: StockReason.ADJUSTMENT,
          note: 'Opening stock',
        })
      }
    }

    revalidateInventory()
    revalidatePath('/sales')
    return { ok: `${name} added.` }
  } catch (error) {
    return { error: describe(error, 'dessert') }
  }
}

export async function adjustStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession()
  try {
    const ingredientId = String(formData.get('ingredientId') ?? '') || undefined
    const dessertId = String(formData.get('dessertId') ?? '') || undefined
    const direction = String(formData.get('direction') ?? 'add')
    const amountRaw = String(formData.get('amount') ?? '').trim()
    if (!amountRaw) throw new Error('Enter how much.')

    // Ingredients are counted in thousandths of their unit; desserts in pieces.
    const magnitude = ingredientId ? toMilli(amountRaw) : Math.round(Number(amountRaw))
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      throw new Error('Enter an amount above zero.')
    }

    const reason = direction === 'waste' ? StockReason.WASTE : StockReason.ADJUSTMENT
    const delta = direction === 'add' ? magnitude : -magnitude

    await recordAdjustment({
      ingredientId,
      dessertId,
      delta,
      reason,
      note: String(formData.get('note') ?? '').trim() || null,
    })

    revalidateInventory()
    return { ok: 'Stock updated.' }
  } catch (error) {
    return { error: describe(error, 'stock') }
  }
}

export async function updateIngredient(formData: FormData) {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  const reorderRaw = String(formData.get('reorderLevel') ?? '').trim()
  await prisma.ingredient.update({
    where: { id },
    data: {
      name: String(formData.get('name') ?? '').trim() || undefined,
      reorderLevel: reorderRaw ? toMilli(reorderRaw) : 0,
    },
  })
  revalidateInventory()
}

export async function updateDessert(formData: FormData) {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  const priceRaw = String(formData.get('price') ?? '').trim()
  const reorderRaw = String(formData.get('reorderLevel') ?? '').trim()
  await prisma.dessert.update({
    where: { id },
    data: {
      name: String(formData.get('name') ?? '').trim() || undefined,
      ...(priceRaw ? { priceDirhams: dinarsToDirhams(priceRaw) } : {}),
      reorderLevel: reorderRaw ? Math.round(Number(reorderRaw)) : 0,
      active: formData.get('active') === 'on',
    },
  })
  revalidateInventory()
  revalidatePath('/sales')
}

function describe(error: unknown, subject: string): string {
  if (error instanceof Error) {
    // Prisma reports a duplicate name as P2002; say so in plain words.
    if ('code' in error && (error as { code?: string }).code === 'P2002') {
      return `There is already a ${subject} with that name.`
    }
    return error.message
  }
  return `Could not save that ${subject}.`
}
