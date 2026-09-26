import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CATEGORY_LABELS, formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/units'
import { PurchaseCategory } from '@/generated/prisma/enums'
import { PageHeader, Stat } from '@/components/page-header'

export default async function PurchasesPage({ searchParams }: PageProps<'/purchases'>) {
  await requireSession()
  const params = await searchParams

  const category = typeof params.category === 'string' ? params.category : ''
  const search = typeof params.q === 'string' ? params.q.trim() : ''
  const missing = params.missing === '1'

  const purchases = await prisma.purchase.findMany({
    where: {
      ...(category in PurchaseCategory ? { category: category as PurchaseCategory } : {}),
      ...(missing ? { receipts: { none: {} } } : {}),
      ...(search
        ? {
            OR: [
              { supplierName: { contains: search, mode: 'insensitive' as const } },
              { notes: { contains: search, mode: 'insensitive' as const } },
              { items: { some: { description: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    },
    orderBy: { date: 'desc' },
    include: { _count: { select: { receipts: true } } },
    take: 200,
  })

  const [total, withReceipt] = await Promise.all([
    prisma.purchase.count(),
    prisma.purchase.count({ where: { receipts: { some: {} } } }),
  ])
  const coverage = total === 0 ? 100 : Math.round((withReceipt / total) * 100)
  const spent = purchases.reduce((sum, purchase) => sum + purchase.totalDirhams, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        subtitle="Every purchase with its receipt. This is what the loan report is built from."
        action={
          <Link href="/purchases/new" className="btn-primary">
            Add purchase
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Purchases recorded" value={String(total)} />
        <Stat label="Total shown below" value={formatMoney(spent)} />
        <Stat
          label="Have a receipt"
          value={`${coverage}%`}
          tone={coverage === 100 ? 'good' : coverage >= 80 ? 'warn' : 'bad'}
          note={total - withReceipt > 0 ? `${total - withReceipt} still missing` : 'All covered'}
        />
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">
            Search
          </label>
          <input id="q" name="q" defaultValue={search} placeholder="Supplier, item or note" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="category">
            Category
          </label>
          <select id="category" name="category" defaultValue={category} className="input">
            <option value="">All</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 py-2.5 text-sm">
          <input
            type="checkbox"
            name="missing"
            value="1"
            defaultChecked={missing}
            className="size-4 accent-brand"
          />
          Missing receipt only
        </label>
        <button type="submit" className="btn-secondary">
          Apply
        </button>
      </form>

      {purchases.length === 0 ? (
        <p className="card p-8 text-center text-muted">
          Nothing here yet.{' '}
          <Link href="/purchases/new" className="font-medium text-brand hover:underline">
            Add your first purchase
          </Link>
          .
        </p>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Category</th>
                <th className="text-right">Total</th>
                <th>Receipt</th>
                <th>Loan</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-cream">
                  <td className="whitespace-nowrap">
                    <Link href={`/purchases/${purchase.id}`} className="font-medium hover:text-brand">
                      {formatDate(purchase.date)}
                    </Link>
                  </td>
                  <td>{purchase.supplierName ?? <span className="text-muted">—</span>}</td>
                  <td className="whitespace-nowrap text-muted">{CATEGORY_LABELS[purchase.category]}</td>
                  <td className="num whitespace-nowrap text-right font-medium">
                    {formatMoney(purchase.totalDirhams)}
                  </td>
                  <td>
                    {purchase._count.receipts > 0 ? (
                      <span className="badge bg-good-soft text-good">
                        {purchase._count.receipts} attached
                      </span>
                    ) : (
                      <span className="badge bg-bad-soft text-bad">Missing</span>
                    )}
                  </td>
                  <td>
                    {purchase.forLoan ? (
                      <span className="badge bg-brand-soft text-brand">In report</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
