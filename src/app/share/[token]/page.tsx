import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { noteShareView, resolveShareLink } from '@/lib/share'
import { buildLoanReport } from '@/lib/loan-report'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/units'
import { CategoryBreakdown, ReportTable } from '@/components/report-table'

export const metadata = { robots: { index: false, follow: false } }

/**
 * The read-only view behind a share link. It is built from the same report as
 * the owner's screen, but restricted to loan purchases in the link's range —
 * sales, stock and recipes are not reachable from here at all.
 */
export default async function SharedReportPage({ params }: PageProps<'/share/[token]'>) {
  const { token } = await params

  const link = await resolveShareLink(token)
  if (!link) notFound()

  const [report, owner] = await Promise.all([
    buildLoanReport({ from: link.fromDate, to: link.toDate }),
    prisma.user.findFirst({ select: { name: true } }),
  ])
  await noteShareView(link.id)

  const query = new URLSearchParams({ token })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Record of business purchases
        </p>
        <h1 className="mt-1 text-2xl font-bold">{owner?.name ?? 'Dessert shop'}</h1>
        <p className="mt-1 text-sm text-muted">
          {link.fromDate || link.toDate
            ? `${link.fromDate ? formatDate(link.fromDate) : 'Start'} – ${
                link.toDate ? formatDate(link.toDate) : 'today'
              }`
            : 'All purchases on record'}
          {link.expiresAt ? ` · This link expires ${formatDate(link.expiresAt)}` : null}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`/api/loan-report/pdf?${query}`} className="btn-primary">
            Download PDF
          </a>
          <a href={`/api/loan-report/excel?${query}`} className="btn-secondary">
            Download Excel
          </a>
        </div>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Figure label="Total spent" value={formatMoney(report.totalDirhams)} />
        <Figure label="Purchases" value={String(report.purchases.length)} />
        <Figure label="Receipts attached" value={String(report.receiptCount)} />
      </div>

      <div className="space-y-6">
        <CategoryBreakdown report={report} />
        <ReportTable report={report} shareToken={token} />
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Prepared with Dessert Shop Manager. Figures in Libyan dinar (LYD).
      </p>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="num mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
