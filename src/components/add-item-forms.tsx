'use client'

import { useActionState } from 'react'
import {
  createDessert,
  createIngredient,
  type ActionState,
} from '@/app/(app)/inventory/actions'
import { Unit } from '@/generated/prisma/enums'
import { unitLabel } from '@/lib/units'

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="mt-3 text-sm text-bad">{state.error}</p>
  if (state.ok) return <p className="mt-3 text-sm text-good">{state.ok}</p>
  return null
}

export function AddIngredientForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createIngredient, {})

  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold">Add an ingredient</summary>
      <form action={formAction} key={state.ok} className="mt-4 grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input name="name" required placeholder="e.g. Flour" className="input" />
        </div>
        <div>
          <label className="label">Measured in</label>
          <select name="unit" defaultValue="KG" className="input">
            {Object.values(Unit).map((unit) => (
              <option key={unit} value={unit}>
                {unitLabel(unit)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Stock you have now</label>
          <input name="openingStock" inputMode="decimal" placeholder="0" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Warn me below</label>
          <input name="reorderLevel" inputMode="decimal" placeholder="0" className="input" />
          <p className="hint">Leave at 0 for no warning.</p>
        </div>
        <div className="flex items-end sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Saving…' : 'Add ingredient'}
          </button>
        </div>
      </form>
      <Feedback state={state} />
    </details>
  )
}

export function AddDessertForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createDessert, {})

  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold">Add a dessert</summary>
      <form action={formAction} key={state.ok} className="mt-4 grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input name="name" required placeholder="e.g. Baklava" className="input" />
        </div>
        <div>
          <label className="label">Price each (LYD)</label>
          <input name="price" inputMode="decimal" required placeholder="0.00" className="input" />
        </div>
        <div>
          <label className="label">Pieces you have now</label>
          <input name="openingStock" inputMode="numeric" placeholder="0" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Warn me below</label>
          <input name="reorderLevel" inputMode="numeric" placeholder="0" className="input" />
          <p className="hint">Leave at 0 for no warning.</p>
        </div>
        <div className="flex items-end sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? 'Saving…' : 'Add dessert'}
          </button>
        </div>
      </form>
      <Feedback state={state} />
    </details>
  )
}
