import Link from 'next/link'
import { CATEGORY_LABELS, formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/units'
import type { LoanReport } from '@/lib/loan-report'

/**
 * The itemised list of purchases, shown both to the owner and through a share
 * link. `shareToken` is set only in the shared view, where receipts are fetched
 * with the token and purchases are not clickable.
 */
export function ReportTable({ report, shareToken }: { report: LoanReport; shareToken?: string }) {
  if (report.purchases.length === 0) {
    return (
      <p className="card p-8 text-center text-muted">
        No purchases in this period.
      </p>
    )
  }

  const receiptUrl = (id: string) =>
    shareToken ? `/api/receipts/${id}?token=${encodeURIComponent(shareToken)}` : `/api/receipts/${id}`

  return (
    <div className="card table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Supplier</th>
            <th>Category</th>
            <th>Details</th>
            <th className="text-right">Amount</th>
            <th>Receipt</th>
          </tr>
        </thead>
        <tbody>
          {report.purchases.map((purchase, index) => (
            <tr key={purchase.id}>
              <td className="num text-muted">{index + 1}</td>
              <td className="whitespace-nowrap">
                {shareToken ? (
                  formatDate(purchase.date)
                ) : (
                  <Link href={`/purchases/${purchase.id}`} className="hover:text-brand">
                    {formatDate(purchase.date)}
                  </Link>
                )}
              </td>
              <td>{purchase.supplierName ?? '—'}</td>
              <td className="whitespace-nowrap text-muted">
                {CATEGORY_LABELS[purchase.category]}
              </td>
              <td className="max-w-64 text-muted">
                {purchase.items.length > 0
                  ? purchase.items.map((item) => item.description).join(', ')
                  : (purchase.notes ?? '—')}
              </td>
              <td className="num whitespace-nowrap text-right font-medium">
                {formatMoney(purchase.totalDirhams)}
              </td>
              <td>
                {purchase.receipts.length === 0 ? (
                  <span className="badge bg-bad-soft text-bad">Missing</span>
                ) : (
                  <div className="flex gap-1">
                    {purchase.receipts.map((receipt) => (
                      <a
                        key={receipt.id}
                        href={receiptUrl(receipt.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        {receipt.mimeType === 'application/pdf' ? (
                          <span className="badge bg-cream text-muted">PDF</span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={receiptUrl(receipt.id)}
                            alt="Receipt"
                            className="size-12 rounded border border-line bg-cream object-contain"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} className="text-right font-semibold">
              Total
            </td>
            <td className="num text-right text-base font-bold">
              {formatMoney(report.totalDirhams)}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function CategoryBreakdown({ report }: { report: LoanReport }) {
  if (report.byCategory.length === 0) return null
  return (
    <div className="card table-wrap">
      <h2 className="border-b border-line px-4 py-3 font-semibold">Spending by category</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Category</th>
            <th className="text-right">Purchases</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {report.byCategory.map((row) => (
            <tr key={row.category}>
              <td className="font-medium">{CATEGORY_LABELS[row.category]}</td>
              <td className="num text-right text-muted">{row.count}</td>
              <td className="num text-right font-medium">{formatMoney(row.totalDirhams)}</td>
              <td className="num text-right text-muted">
                {report.totalDirhams === 0
                  ? '—'
                  : `${Math.round((row.totalDirhams / report.totalDirhams) * 100)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
