'use client'

import { useActionState } from 'react'
import { adjustStock, type ActionState } from '@/app/(app)/inventory/actions'

/**
 * The correction form that sits under each inventory row. Kept collapsed so the
 * list stays readable, and open only while it is being used.
 */
export function StockAdjust({
  ingredientId,
  dessertId,
  unitLabel,
}: {
  ingredientId?: string
  dessertId?: string
  unitLabel: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(adjustStock, {})

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm font-medium text-brand hover:underline">
        Correct stock
      </summary>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        {ingredientId ? <input type="hidden" name="ingredientId" value={ingredientId} /> : null}
        {dessertId ? <input type="hidden" name="dessertId" value={dessertId} /> : null}

        <div>
          <label className="label">What happened</label>
          <select name="direction" className="input" defaultValue="add">
            <option value="add">Add stock</option>
            <option value="remove">Remove (counted less)</option>
            <option value="waste">Waste / spoiled</option>
          </select>
        </div>
        <div className="w-32">
          <label className="label">Amount ({unitLabel})</label>
          <input name="amount" inputMode="decimal" required className="input" />
        </div>
        <div className="min-w-40 flex-1">
          <label className="label">Reason (optional)</label>
          <input name="note" className="input" placeholder="e.g. stock count" />
        </div>
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? 'Saving…' : 'Apply'}
        </button>
      </form>
      {state.error ? <p className="mt-2 text-sm text-bad">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-sm text-good">{state.ok}</p> : null}
    </details>
  )
}
