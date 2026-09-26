import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDessertStock } from '@/lib/stock'
import { daysAgo, startOfMonth, startOfToday } from '@/lib/period'
import { formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/units'
import { PageHeader, Stat } from '@/components/page-header'
import { SellPanel, type SellableDessert } from '@/components/sell-panel'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { deleteSale } from './actions'

async function totalSince(since: Date): Promise<{ money: number; pieces: number }> {
  const lines = await prisma.saleLine.findMany({
    where: { sale: { date: { gte: since } } },
    select: { quantity: true, unitPriceDirhams: true },
  })
  return {
    money: lines.reduce((sum, line) => sum + line.quantity * line.unitPriceDirhams, 0),
    pieces: lines.reduce((sum, line) => sum + line.quantity, 0),
  }
}

export default async function SalesPage() {
  await requireSession()

  const [desserts, stock, today, week, month, recent] = await Promise.all([
    prisma.dessert.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    getDessertStock(),
    totalSince(startOfToday()),
    totalSince(daysAgo(6)),
    totalSince(startOfMonth()),
    prisma.sale.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { lines: { include: { dessert: { select: { name: true } } } } },
      take: 20,
    }),
  ])

  const sellable: SellableDessert[] = desserts.map((dessert) => ({
    id: dessert.id,
    name: dessert.name,
    priceDirhams: dessert.priceDirhams,
    inStock: stock.get(dessert.id) ?? 0,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        subtitle="Tap what you sold. This is separate from the loan report."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Today" value={formatMoney(today.money)} note={`${today.pieces} pieces`} tone="brand" />
        <Stat label="Last 7 days" value={formatMoney(week.money)} note={`${week.pieces} pieces`} />
        <Stat label="This month" value={formatMoney(month.money)} note={`${month.pieces} pieces`} />
      </div>

      <SellPanel desserts={sellable} />

      <section className="card table-wrap">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Recent sales</h2>
        {recent.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No sales recorded yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th className="text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recent.map((sale) => (
                <tr key={sale.id}>
                  <td className="whitespace-nowrap">{formatDateTime(sale.date)}</td>
                  <td>
                    {sale.lines
                      .map((line) => `${line.quantity} × ${line.dessert.name}`)
                      .join(', ')}
                    {sale.notes ? <span className="block text-xs text-muted">{sale.notes}</span> : null}
                  </td>
                  <td className="num whitespace-nowrap text-right font-medium">
                    {formatMoney(
                      sale.lines.reduce(
                        (sum, line) => sum + line.quantity * line.unitPriceDirhams,
                        0,
                      ),
                    )}
                  </td>
                  <td className="text-right">
                    <form action={deleteSale}>
                      <input type="hidden" name="id" value={sale.id} />
                      <ConfirmSubmit
                        className="text-sm text-muted hover:text-bad"
                        message="Undo this sale? The pieces go back into stock."
                      >
                        Undo
                      </ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
