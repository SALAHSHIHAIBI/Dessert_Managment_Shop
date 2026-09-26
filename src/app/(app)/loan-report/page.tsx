import { requireSession } from '@/lib/auth'
import { buildLoanReport, parseRange } from '@/lib/loan-report'
import { listShareLinks } from '@/lib/share'
import { formatMoney } from '@/lib/units'
import { PageHeader, Stat } from '@/components/page-header'
import { CategoryBreakdown, ReportTable } from '@/components/report-table'
import { ShareLinks } from '@/components/share-links'

export default async function LoanReportPage({ searchParams }: PageProps<'/loan-report'>) {
  await requireSession()
  const params = await searchParams

  const from = typeof params.from === 'string' ? params.from : ''
  const to = typeof params.to === 'string' ? params.to : ''
  const range = parseRange(from, to)

  const [report, links] = await Promise.all([buildLoanReport(range), listShareLinks()])

  const query = new URLSearchParams()
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  const suffix = query.toString() ? `?${query.toString()}` : ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan report"
        subtitle="Everything marked for the loan, with its receipts, ready to hand in."
      />

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="from">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className="input" />
        </div>
        <button type="submit" className="btn-secondary">
          Apply
        </button>
        <div className="ml-auto flex gap-2">
          <a href={`/api/loan-report/pdf${suffix}`} className="btn-primary">
            Download PDF
          </a>
          <a href={`/api/loan-report/excel${suffix}`} className="btn-secondary">
            Download Excel
          </a>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total spent" value={formatMoney(report.totalDirhams)} tone="brand" />
        <Stat
          label="Purchases"
          value={String(report.purchases.length)}
          note={`${report.receiptCount} receipts attached`}
        />
        <Stat
          label="Missing a receipt"
          value={String(report.missingReceiptCount)}
          tone={report.missingReceiptCount === 0 ? 'good' : 'bad'}
          note={
            report.missingReceiptCount === 0
              ? 'Every purchase is backed up'
              : 'Add these before handing the file in'
          }
        />
      </div>

      <CategoryBreakdown report={report} />
      <ReportTable report={report} />

      <ShareLinks links={links} defaultFrom={from} defaultTo={to} />
    </div>
  )
}
