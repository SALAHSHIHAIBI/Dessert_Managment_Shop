'use client'

import { useActionState, useState } from 'react'
import { addProduction, type ProductionState } from '@/app/(app)/production/actions'
import { toDateInput } from '@/lib/format'
import { formatQuantity } from '@/lib/units'
import type { Unit } from '@/generated/prisma/enums'

export type DessertWithRecipe = {
  id: string
  name: string
  recipe: Array<{ name: string; quantity: number; unit: Unit; inStock: number }>
}

/**
 * Recording a batch. The ingredient list updates as the number is typed, so the
 * cost in ingredients is visible before anything is saved.
 */
export function ProductionForm({ desserts }: { desserts: DessertWithRecipe[] }) {
  const [state, formAction, pending] = useActionState<ProductionState, FormData>(addProduction, {})
  const [dessertId, setDessertId] = useState(desserts[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')

  const dessert = desserts.find((d) => d.id === dessertId)
  const count = Number(quantity)
  const preview =
    dessert && Number.isFinite(count) && count > 0
      ? dessert.recipe.map((line) => ({
          ...line,
          needed: line.quantity * count,
          short: line.quantity * count > line.inStock,
        }))
      : []

  if (desserts.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        Add a dessert on the Inventory screen before recording a batch.
      </p>
    )
  }

  return (
    <form action={formAction} className="card space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="dessertId">
            What did you make?
          </label>
          <select
            id="dessertId"
            name="dessertId"
            value={dessertId}
            onChange={(e) => setDessertId(e.target.value)}
            className="input"
          >
            {desserts.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="quantity">
            How many pieces?
          </label>
          <input
            id="quantity"
            name="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="numeric"
            required
            placeholder="0"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={toDateInput(new Date())}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">
          Notes (optional)
        </label>
        <input id="notes" name="notes" className="input" placeholder="e.g. morning batch" />
      </div>

      {dessert && dessert.recipe.length === 0 ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {dessert.name} has no recipe, so this will add pieces without using any ingredients.
        </p>
      ) : null}

      {preview.length > 0 ? (
        <div className="rounded-lg bg-cream p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            This will use
          </p>
          <ul className="space-y-1 text-sm">
            {preview.map((line) => (
              <li key={line.name} className="flex justify-between gap-4">
                <span>{line.name}</span>
                <span className={`num ${line.short ? 'font-semibold text-bad' : 'text-muted'}`}>
                  {formatQuantity(line.needed, line.unit)}
                  {line.short ? ` (only ${formatQuantity(line.inStock, line.unit)} left)` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-good">{state.ok}</p> : null}
      {state.warning ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{state.warning}</p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Saving…' : 'Record batch'}
      </button>
    </form>
  )
}
