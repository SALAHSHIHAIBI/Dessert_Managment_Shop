'use client'

import { useActionState, useRef, useState } from 'react'
import { saveRecipe, type RecipeState } from '@/app/(app)/recipes/actions'
import { fromMilli, unitLabel } from '@/lib/units'
import type { Unit } from '@/generated/prisma/enums'

type Ingredient = { id: string; name: string; unit: Unit }
type Line = { key: string; ingredientId: string; quantity: string }

function blankLine(key: string): Line {
  return { key, ingredientId: '', quantity: '' }
}

/**
 * The amounts here are per single piece. Production multiplies them by how many
 * pieces were made, so this is the only place the ratio has to be right.
 */
export function RecipeEditor({
  dessertId,
  dessertName,
  ingredients,
  initialLines,
}: {
  dessertId: string
  dessertName: string
  ingredients: Ingredient[]
  initialLines: Array<{ ingredientId: string; quantity: number }>
}) {
  const [state, formAction, pending] = useActionState<RecipeState, FormData>(saveRecipe, {})
  // Lines already on the recipe are keyed by their position. Lines added while
  // editing take the next number from a counter, which only event handlers touch.
  const nextKey = useRef(0)
  const makeKey = () => `added-${nextKey.current++}`
  const [lines, setLines] = useState<Line[]>(() =>
    initialLines.length > 0
      ? initialLines.map((line, index) => ({
          key: `line-${index}`,
          ingredientId: line.ingredientId,
          quantity: fromMilli(line.quantity),
        }))
      : [blankLine('line-0')],
  )

  const update = (key: string, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  if (ingredients.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        Add some ingredients on the Inventory screen first — a recipe is built out of them.
      </p>
    )
  }

  return (
    <form action={formAction} className="card space-y-4 p-4">
      <input type="hidden" name="dessertId" value={dessertId} />

      <p className="text-sm text-muted">
        How much of each ingredient goes into <strong>one piece</strong> of {dessertName}.
      </p>

      <div className="space-y-3">
        {lines.map((line) => {
          const ingredient = ingredients.find((i) => i.id === line.ingredientId)
          return (
            <div key={line.key} className="flex flex-wrap items-end gap-3">
              <div className="min-w-44 flex-1">
                <label className="label sr-only">Ingredient</label>
                <select
                  name="ingredientId"
                  value={line.ingredientId}
                  onChange={(e) => update(line.key, { ingredientId: e.target.value })}
                  className="input"
                >
                  <option value="">Choose an ingredient</option>
                  {ingredients.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-36">
                <label className="label sr-only">Amount</label>
                <div className="flex items-center gap-2">
                  <input
                    name="quantity"
                    value={line.quantity}
                    onChange={(e) => update(line.key, { quantity: e.target.value })}
                    inputMode="decimal"
                    placeholder="0"
                    className="input"
                  />
                  <span className="w-8 text-sm text-muted">
                    {ingredient ? unitLabel(ingredient.unit) : ''}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setLines((current) =>
                    current.length > 1 ? current.filter((l) => l.key !== line.key) : [blankLine(makeKey())],
                  )
                }
                className="px-2 py-2.5 text-sm text-muted hover:text-bad"
                aria-label="Remove ingredient"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setLines((current) => [...current, blankLine(makeKey())])}
        className="text-sm font-medium text-brand hover:underline"
      >
        + Add ingredient
      </button>

      {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-good">{state.ok}</p> : null}

      <div className="border-t border-line pt-4">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : 'Save recipe'}
        </button>
      </div>
    </form>
  )
}
