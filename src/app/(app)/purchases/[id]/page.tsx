import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CATEGORY_LABELS, PAYMENT_LABELS, fileSize, formatDate, formatDateTime } from '@/lib/format'
import { formatMoney, formatQuantity, fromMilli } from '@/lib/units'
import { PageHeader } from '@/components/page-header'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { deletePurchase, deleteReceipt } from '../actions'

export default async function PurchaseDetailPage({ params }: PageProps<'/purchases/[id]'>) {
  await requireSession()
  const { id } = await params

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      receipts: { orderBy: { uploadedAt: 'asc' } },
      items: { include: { ingredient: true } },
    },
  })
  if (!purchase) notFound()

  const itemsTotal = purchase.items.reduce(
    (sum, item) => sum + Math.round((item.quantity / 1000) * item.unitPriceDirhams),
    0,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatDate(purchase.date)}
        subtitle={purchase.supplierName ?? 'No supplier recorded'}
        action={
          <div className="flex gap-2">
            <Link href={`/purchases/${purchase.id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <form action={deletePurchase}>
              <input type="hidden" name="id" value={purchase.id} />
              <ConfirmSubmit
                className="btn-danger"
                message="Delete this purchase, its receipts and its stock entries?"
              >
                Delete
              </ConfirmSubmit>
            </form>
          </div>
        }
      />

      <div className="card divide-y divide-line">
        <Row label="Total">
          <span className="num text-lg font-bold">{formatMoney(purchase.totalDirhams)}</span>
        </Row>
        <Row label="Category">{CATEGORY_LABELS[purchase.category]}</Row>
        <Row label="Paid by">{PAYMENT_LABELS[purchase.paymentMethod]}</Row>
        <Row label="In loan report">
          {purchase.forLoan ? (
            <span className="badge bg-brand-soft text-brand">Yes</span>
          ) : (
            <span className="badge bg-cream text-muted">No</span>
          )}
        </Row>
        {purchase.notes ? <Row label="Notes">{purchase.notes}</Row> : null}
      </div>

      <section className="card p-4">
        <h2 className="mb-4 font-semibold">
          Receipts{' '}
          {purchase.receipts.length === 0 ? (
            <span className="badge ml-2 bg-bad-soft text-bad">None attached</span>
          ) : null}
        </h2>

        {purchase.receipts.length === 0 ? (
          <p className="text-sm text-muted">
            This purchase has no receipt. The loan file is stronger with one —{' '}
            <Link href={`/purchases/${purchase.id}/edit`} className="font-medium text-brand hover:underline">
              add it now
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-3">
            {purchase.receipts.map((receipt) => (
              <li key={receipt.id} className="card overflow-hidden">
                <a href={`/api/receipts/${receipt.id}`} target="_blank" rel="noreferrer">
                  {receipt.mimeType === 'application/pdf' ? (
                    <div className="flex h-40 items-center justify-center bg-cream font-medium text-muted">
                      Open PDF
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/receipts/${receipt.id}`}
                      alt={receipt.fileName ?? 'Receipt'}
                      // Contain, not cover: a cropped receipt is no use as evidence.
                      className="h-40 w-full bg-cream object-contain"
                    />
                  )}
                </a>
                <div className="flex items-center justify-between gap-2 p-2 text-xs text-muted">
                  <span>
                    {fileSize(receipt.sizeBytes)} · {formatDateTime(receipt.uploadedAt)}
                  </span>
                  <form action={deleteReceipt}>
                    <input type="hidden" name="receiptId" value={receipt.id} />
                    <ConfirmSubmit className="text-bad hover:underline" message="Delete this receipt?">
                      Delete
                    </ConfirmSubmit>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {purchase.items.length > 0 ? (
        <section className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Adds to inventory</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Unit price</th>
                <th className="text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium">{item.description}</td>
                  <td className="text-muted">
                    {item.ingredient ? item.ingredient.name : <span>—</span>}
                  </td>
                  <td className="num text-right">
                    {item.ingredient
                      ? formatQuantity(item.quantity, item.ingredient.unit)
                      : fromMilli(item.quantity)}
                  </td>
                  <td className="num text-right">{formatMoney(item.unitPriceDirhams)}</td>
                  <td className="num text-right">
                    {formatMoney(Math.round((item.quantity / 1000) * item.unitPriceDirhams))}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="text-right font-semibold">
                  Items add up to
                </td>
                <td className="num text-right font-semibold">{formatMoney(itemsTotal)}</td>
              </tr>
            </tbody>
          </table>
          {itemsTotal !== purchase.totalDirhams ? (
            <p className="px-3 pb-3 text-xs text-muted">
              The receipt total ({formatMoney(purchase.totalDirhams)}) is what counts. Item lines are
              detail, so a small difference is fine.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}
