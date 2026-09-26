'use client'

import { startTransition, useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import imageCompression from 'browser-image-compression'
import type { PurchaseFormState } from '@/app/(app)/purchases/actions'
import { CATEGORY_LABELS, PAYMENT_LABELS, fileSize, toDateInput } from '@/lib/format'
import { fromMilli, formatDirhams, unitLabel } from '@/lib/units'
import type { Unit } from '@/generated/prisma/enums'

export type IngredientOption = { id: string; name: string; unit: Unit }

export type PurchaseInitial = {
  id: string
  date: Date
  category: string
  paymentMethod: string
  totalDirhams: number
  supplierName: string | null
  notes: string | null
  forLoan: boolean
  items: Array<{
    description: string
    quantity: number
    unitPriceDirhams: number
    ingredientId: string | null
  }>
}

type ItemRow = {
  key: string
  description: string
  quantity: string
  unitPrice: string
  ingredientId: string
}

function blankRow(key: string): ItemRow {
  return { key, description: '', quantity: '', unitPrice: '', ingredientId: '' }
}

// Receipts only have to be readable, so they are shrunk hard before upload.
// This keeps the database small and uploads quick on a slow connection.
const COMPRESSION = { maxSizeMB: 0.25, maxWidthOrHeight: 1600, useWebWorker: true }

export function PurchaseForm({
  action,
  ingredients,
  suppliers,
  initial,
}: {
  action: (state: PurchaseFormState, formData: FormData) => Promise<PurchaseFormState>
  ingredients: IngredientOption[]
  suppliers: string[]
  initial?: PurchaseInitial
}) {
  const [state, formAction, pending] = useActionState<PurchaseFormState, FormData>(action, {})
  // Rows already on the purchase are keyed by their position. Rows added while
  // editing take the next number from a counter, which only event handlers touch.
  const nextKey = useRef(0)
  const makeKey = () => `added-${nextKey.current++}`
  const [rows, setRows] = useState<ItemRow[]>(() =>
    initial && initial.items.length > 0
      ? initial.items.map((item, index) => ({
          key: `row-${index}`,
          description: item.description,
          quantity: item.quantity ? fromMilli(item.quantity) : '',
          unitPrice: item.unitPriceDirhams ? formatDirhams(item.unitPriceDirhams) : '',
          ingredientId: item.ingredientId ?? '',
        }))
      : [blankRow('row-0')],
  )
  const [photos, setPhotos] = useState<File[]>([])
  const [shrinking, setShrinking] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  async function addPhotos(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setFileError(null)
    setShrinking(true)
    try {
      const prepared = await Promise.all(
        Array.from(fileList).map(async (file) =>
          // PDFs are kept as they are; only photos can be resized.
          file.type === 'application/pdf' ? file : await imageCompression(file, COMPRESSION),
        ),
      )
      setPhotos((current) => [...current, ...prepared])
    } catch {
      setFileError('Could not read that file. Try taking the photo again.')
    } finally {
      setShrinking(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    // The picker's own entry is dropped and replaced with the shrunk versions.
    formData.delete('receiptPicker')
    for (const photo of photos) formData.append('receipts', photo)
    // Inside a transition, so `pending` really does go true and the Save button
    // disables — otherwise a second tap on a slow connection saves twice.
    startTransition(() => formAction(formData))
  }

  const updateRow = (key: string, patch: Partial<ItemRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      {state.error ? (
        <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>
      ) : null}

      <section className="card p-4">
        <h2 className="mb-4 font-semibold">Purchase details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={toDateInput(initial?.date ?? new Date())}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="total">
              Total on the receipt (LYD)
            </label>
            <input
              id="total"
              name="total"
              inputMode="decimal"
              required
              placeholder="0.00"
              defaultValue={initial ? formatDirhams(initial.totalDirhams) : ''}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="supplierName">
              Shop or supplier
            </label>
            <input
              id="supplierName"
              name="supplierName"
              list="supplier-options"
              defaultValue={initial?.supplierName ?? ''}
              placeholder="e.g. Al-Madina Wholesale"
              className="input"
            />
            <datalist id="supplier-options">
              {suppliers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={initial?.category ?? 'INGREDIENTS'}
              className="input"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="paymentMethod">
              Paid by
            </label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue={initial?.paymentMethod ?? 'CASH'}
              className="input"
            >
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">
              Notes (optional)
            </label>
            <input id="notes" name="notes" defaultValue={initial?.notes ?? ''} className="input" />
          </div>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-lg bg-cream p-3">
          <input
            type="checkbox"
            name="forLoan"
            defaultChecked={initial?.forLoan ?? true}
            className="mt-0.5 size-4 accent-brand"
          />
          <span className="text-sm">
            <span className="font-medium">Include in the loan report</span>
            <span className="block text-muted">
              Leave this on for anything the government should see.
            </span>
          </span>
        </label>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Receipt photos</h2>
        <p className="mb-4 text-sm text-muted">
          Take a photo of the paper receipt. It is shrunk automatically before it is saved.
        </p>

        <label className="btn-secondary cursor-pointer">
          <input
            type="file"
            name="receiptPicker"
            accept="image/*,application/pdf"
            multiple
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              void addPhotos(event.target.files)
              event.target.value = ''
            }}
          />
          {shrinking ? 'Preparing…' : 'Add receipt'}
        </label>

        {fileError ? <p className="mt-3 text-sm text-bad">{fileError}</p> : null}

        {photos.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <li key={`${photo.name}-${index}`} className="card overflow-hidden p-2 text-xs">
                {photo.type === 'application/pdf' ? (
                  <div className="flex h-24 items-center justify-center rounded bg-cream text-muted">
                    PDF
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={URL.createObjectURL(photo)}
                    alt=""
                    className="h-24 w-full rounded object-cover"
                  />
                )}
                <p className="mt-2 truncate text-muted">{fileSize(photo.size)}</p>
                <button
                  type="button"
                  onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                  className="mt-1 text-bad hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">What was bought (optional)</h2>
        <p className="mb-4 text-sm text-muted">
          Linking a line to an ingredient is what adds it to your inventory.
        </p>

        <div className="space-y-3">
          {rows.map((row) => {
            const ingredient = ingredients.find((i) => i.id === row.ingredientId)
            return (
              <div key={row.key} className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <label className="label sm:sr-only">Description</label>
                  <input
                    name="itemDescription"
                    value={row.description}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    placeholder="Description"
                    className="input"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="label sm:sr-only">Adds to ingredient</label>
                  <select
                    name="itemIngredientId"
                    value={row.ingredientId}
                    onChange={(e) => updateRow(row.key, { ingredientId: e.target.value })}
                    className="input"
                  >
                    <option value="">Not an ingredient</option>
                    {ingredients.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label sm:sr-only">Quantity</label>
                  <div className="flex items-center gap-2">
                    <input
                      name="itemQuantity"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      inputMode="decimal"
                      placeholder="Qty"
                      className="input"
                    />
                    {ingredient ? (
                      <span className="text-sm text-muted">{unitLabel(ingredient.unit)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="label sm:sr-only">Unit price</label>
                  <input
                    name="itemUnitPrice"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                    inputMode="decimal"
                    placeholder="Price"
                    className="input"
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => setRows((c) => (c.length > 1 ? c.filter((r) => r.key !== row.key) : c))}
                    className="px-2 py-2 text-sm text-muted hover:text-bad"
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setRows((current) => [...current, blankRow(makeKey())])}
          className="mt-3 text-sm font-medium text-brand hover:underline"
        >
          + Add another line
        </button>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || shrinking} className="btn-primary">
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Save purchase'}
        </button>
        <Link href={initial ? `/purchases/${initial.id}` : '/purchases'} className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
