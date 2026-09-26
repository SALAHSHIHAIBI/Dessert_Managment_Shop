'use client'

import { useActionState, useState } from 'react'
import { addSale, type SaleState } from '@/app/(app)/sales/actions'
import { formatDirhams, formatMoney } from '@/lib/units'

export type SellableDessert = {
  id: string
  name: string
  priceDirhams: number
  inStock: number
}

type CartLine = { dessertId: string; quantity: number }

/**
 * Tap a dessert to add one. Everything is one tap because this is used with one
 * hand at the counter while a customer waits.
 */
export function SellPanel({ desserts }: { desserts: SellableDessert[] }) {
  const [state, formAction, pending] = useActionState<SaleState, FormData>(addSale, {})
  const [cart, setCart] = useState<CartLine[]>([])
  const [clearedFor, setClearedFor] = useState<string | undefined>(undefined)

  // Empty the counter once a sale has gone through, ready for the next customer.
  // Two identical sales in a row are told apart by the id, not the message.
  if (state.saleId && state.saleId !== clearedFor) {
    setClearedFor(state.saleId)
    setCart([])
  }

  function add(dessertId: string, by = 1) {
    setCart((current) => {
      const existing = current.find((line) => line.dessertId === dessertId)
      if (!existing) return by > 0 ? [...current, { dessertId, quantity: by }] : current
      return current
        .map((line) =>
          line.dessertId === dessertId ? { ...line, quantity: line.quantity + by } : line,
        )
        .filter((line) => line.quantity > 0)
    })
  }

  const byId = new Map(desserts.map((dessert) => [dessert.id, dessert]))
  const total = cart.reduce(
    (sum, line) => sum + (byId.get(line.dessertId)?.priceDirhams ?? 0) * line.quantity,
    0,
  )

  if (desserts.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        Add what you sell on the Inventory screen, then it appears here.
      </p>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {desserts.map((dessert) => {
            const inCart = cart.find((line) => line.dessertId === dessert.id)?.quantity ?? 0
            return (
              <button
                key={dessert.id}
                type="button"
                onClick={() => add(dessert.id)}
                className="card relative p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft"
              >
                <span className="block font-semibold">{dessert.name}</span>
                <span className="num mt-1 block text-sm text-muted">
                  {formatMoney(dessert.priceDirhams)}
                </span>
                <span
                  className={`num mt-2 block text-xs ${
                    dessert.inStock <= 0 ? 'text-bad' : 'text-muted'
                  }`}
                >
                  {dessert.inStock} left
                </span>
                {inCart > 0 ? (
                  <span className="num absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {inCart}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <form action={formAction} className="card h-fit p-4 lg:sticky lg:top-4">
        <h2 className="font-semibold">This sale</h2>

        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Tap a dessert to start.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {cart.map((line) => {
              const dessert = byId.get(line.dessertId)
              if (!dessert) return null
              return (
                <li key={line.dessertId} className="flex items-center gap-2 text-sm">
                  <input type="hidden" name="lineDessertId" value={dessert.id} />
                  <input type="hidden" name="lineQuantity" value={line.quantity} />
                  <input
                    type="hidden"
                    name="lineUnitPrice"
                    value={formatDirhams(dessert.priceDirhams)}
                  />
                  <span className="flex-1 truncate">{dessert.name}</span>
                  <button
                    type="button"
                    onClick={() => add(dessert.id, -1)}
                    className="size-7 rounded border border-line text-muted hover:bg-cream"
                    aria-label={`One less ${dessert.name}`}
                  >
                    −
                  </button>
                  <span className="num w-6 text-center font-medium">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => add(dessert.id, 1)}
                    className="size-7 rounded border border-line text-muted hover:bg-cream"
                    aria-label={`One more ${dessert.name}`}
                  >
                    +
                  </button>
                  <span className="num w-20 text-right text-muted">
                    {formatMoney(dessert.priceDirhams * line.quantity)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-sm text-muted">Total</span>
          <span className="num text-xl font-bold">{formatMoney(total)}</span>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="sale-notes">
            Note (optional)
          </label>
          <input id="sale-notes" name="notes" className="input" placeholder="e.g. birthday order" />
        </div>

        {state.error ? <p className="mt-3 text-sm text-bad">{state.error}</p> : null}
        {state.ok ? <p className="mt-3 text-sm text-good">{state.ok}</p> : null}

        <button
          type="submit"
          disabled={pending || cart.length === 0}
          className="btn-primary mt-4 w-full"
        >
          {pending ? 'Saving…' : 'Record sale'}
        </button>
      </form>
    </div>
  )
}
