'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncPurchaseStock } from '@/lib/stock'
import { dinarsToDirhams, toMilli } from '@/lib/units'
import { parseDateInput } from '@/lib/format'
import { PaymentMethod, PurchaseCategory } from '@/generated/prisma/enums'

export type PurchaseFormState = { error?: string }

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

type ParsedPurchase = {
  date: Date
  category: PurchaseCategory
  paymentMethod: PaymentMethod
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

function parsePurchase(formData: FormData): ParsedPurchase {
  const date = parseDateInput(String(formData.get('date') ?? ''))

  const category = String(formData.get('category') ?? '') as PurchaseCategory
  if (!(category in PurchaseCategory)) throw new Error('Please choose a category.')

  const paymentMethod = String(formData.get('paymentMethod') ?? '') as PaymentMethod
  if (!(paymentMethod in PaymentMethod)) throw new Error('Please choose a payment method.')

  const totalDirhams = dinarsToDirhams(String(formData.get('total') ?? ''))
  if (totalDirhams < 0) throw new Error('The total cannot be negative.')

  const descriptions = formData.getAll('itemDescription').map(String)
  const quantities = formData.getAll('itemQuantity').map(String)
  const unitPrices = formData.getAll('itemUnitPrice').map(String)
  const ingredientIds = formData.getAll('itemIngredientId').map(String)

  const items = descriptions
    .map((description, index) => ({
      description: description.trim(),
      quantityRaw: quantities[index] ?? '',
      unitPriceRaw: unitPrices[index] ?? '',
      ingredientId: ingredientIds[index] || null,
    }))
    // Blank rows are the empty row at the bottom of the form, not an error.
    .filter((item) => item.description || item.quantityRaw || item.ingredientId)
    .map((item) => {
      if (!item.description) throw new Error('Every item needs a description.')
      return {
        description: item.description,
        quantity: item.quantityRaw ? toMilli(item.quantityRaw) : 0,
        unitPriceDirhams: item.unitPriceRaw ? dinarsToDirhams(item.unitPriceRaw) : 0,
        ingredientId: item.ingredientId,
      }
    })

  const supplierName = String(formData.get('supplierName') ?? '').trim()

  return {
    date,
    category,
    paymentMethod,
    totalDirhams,
    supplierName: supplierName || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    forLoan: formData.get('forLoan') === 'on',
    items,
  }
}

/** Suppliers build up from what gets typed, so there is no separate screen for them. */
async function findOrCreateSupplier(name: string | null): Promise<string | null> {
  if (!name) return null
  const existing = await prisma.supplier.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  })
  if (existing) return existing.id
  return (await prisma.supplier.create({ data: { name } })).id
}

async function readReceipts(formData: FormData) {
  const files = formData.getAll('receipts').filter((f): f is File => f instanceof File && f.size > 0)
  return Promise.all(
    files.map(async (file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`${file.name} is not a photo or PDF.`)
      }
      if (file.size > MAX_RECEIPT_BYTES) {
        throw new Error(`${file.name} is too large even after shrinking.`)
      }
      return {
        data: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type,
        fileName: file.name,
        sizeBytes: file.size,
      }
    }),
  )
}

export async function createPurchase(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  await requireSession()

  let id = ''
  try {
    const parsed = parsePurchase(formData)
    const receipts = await readReceipts(formData)
    const supplierId = await findOrCreateSupplier(parsed.supplierName)

    id = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          date: parsed.date,
          category: parsed.category,
          paymentMethod: parsed.paymentMethod,
          totalDirhams: parsed.totalDirhams,
          supplierId,
          supplierName: parsed.supplierName,
          notes: parsed.notes,
          forLoan: parsed.forLoan,
          items: { create: parsed.items },
          receipts: { create: receipts },
        },
      })
      await syncPurchaseStock(tx, purchase.id)
      return purchase.id
    })
  } catch (error) {
    return { error: messageFor(error) }
  }

  revalidatePath('/purchases')
  revalidatePath('/inventory')
  redirect(`/purchases/${id}`)
}

export async function updatePurchase(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  await requireSession()
  const id = String(formData.get('id') ?? '')

  try {
    const parsed = parsePurchase(formData)
    const receipts = await readReceipts(formData)
    const supplierId = await findOrCreateSupplier(parsed.supplierName)

    await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } })
      await tx.purchase.update({
        where: { id },
        data: {
          date: parsed.date,
          category: parsed.category,
          paymentMethod: parsed.paymentMethod,
          totalDirhams: parsed.totalDirhams,
          supplierId,
          supplierName: parsed.supplierName,
          notes: parsed.notes,
          forLoan: parsed.forLoan,
          items: { create: parsed.items },
          receipts: { create: receipts },
        },
      })
      await syncPurchaseStock(tx, id)
    })
  } catch (error) {
    return { error: messageFor(error) }
  }

  revalidatePath('/purchases')
  revalidatePath(`/purchases/${id}`)
  revalidatePath('/inventory')
  redirect(`/purchases/${id}`)
}

export async function deletePurchase(formData: FormData) {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  // Stock entries and receipts are removed with it by the cascade rules.
  await prisma.purchase.delete({ where: { id } })
  revalidatePath('/purchases')
  revalidatePath('/inventory')
  redirect('/purchases')
}

export async function deleteReceipt(formData: FormData) {
  await requireSession()
  const id = String(formData.get('receiptId') ?? '')
  const receipt = await prisma.receipt.delete({ where: { id } })
  revalidatePath(`/purchases/${receipt.purchaseId}`)
  revalidatePath('/purchases')
}

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Could not save this purchase.'
}
