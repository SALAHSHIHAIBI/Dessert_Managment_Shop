'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toMilli } from '@/lib/units'

export type RecipeState = { error?: string; ok?: string }

/**
 * Saves a dessert's whole recipe at once: the submitted lines replace whatever
 * was there, so removing a line is just leaving it out.
 */
export async function saveRecipe(_prev: RecipeState, formData: FormData): Promise<RecipeState> {
  await requireSession()

  try {
    const dessertId = String(formData.get('dessertId') ?? '')
    const ingredientIds = formData.getAll('ingredientId').map(String)
    const quantities = formData.getAll('quantity').map(String)

    const lines = ingredientIds
      .map((ingredientId, index) => ({ ingredientId, raw: (quantities[index] ?? '').trim() }))
      .filter((line) => line.ingredientId && line.raw)
      .map((line) => ({ ingredientId: line.ingredientId, quantity: toMilli(line.raw) }))

    if (lines.some((line) => line.quantity <= 0)) {
      throw new Error('Every ingredient needs an amount above zero.')
    }

    const unique = new Set(lines.map((line) => line.ingredientId))
    if (unique.size !== lines.length) {
      throw new Error('The same ingredient is listed twice.')
    }

    await prisma.$transaction(async (tx) => {
      await tx.recipeLine.deleteMany({ where: { dessertId } })
      if (lines.length > 0) {
        await tx.recipeLine.createMany({
          data: lines.map((line) => ({ ...line, dessertId })),
        })
      }
    })

    revalidatePath('/recipes')
    revalidatePath(`/recipes/${dessertId}`)
    revalidatePath('/production')
    return { ok: 'Recipe saved.' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save the recipe.' }
  }
}
