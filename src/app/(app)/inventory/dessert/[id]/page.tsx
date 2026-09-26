import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDessertStock } from '@/lib/stock'
import { STOCK_REASON_LABELS, formatDate } from '@/lib/format'
import { formatDirhams, formatMoney, formatQuantity } from '@/lib/units'
import { PageHeader } from '@/components/page-header'
import { StockAdjust } from '@/components/stock-adjust'
import { updateDessert } from '../../actions'

export default async function DessertPage({ params }: PageProps<'/inventory/dessert/[id]'>) {
  await requireSession()
  const { id } = await params

  const dessert = await prisma.dessert.findUnique({
    where: { id },
    include: { recipeLines: { include: { ingredient: true } } },
  })
  if (!dessert) notFound()

  const [history, stock] = await Promise.all([
    prisma.stockLog.findMany({
      where: { dessertId: id },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      include: { sale: { select: { id: true } }, production: { select: { id: true } } },
      take: 100,
    }),
    getDessertStock([id]),
  ])
  const level = stock.get(id) ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={dessert.name}
        subtitle={`${formatMoney(dessert.priceDirhams)} each`}
        action={
          <Link href="/inventory?tab=desserts" className="btn-secondary">
            Back to inventory
          </Link>
        }
      />

      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">In stock now</p>
        <p className="num mt-1 text-3xl font-bold">{level.toLocaleString('en-US')} pieces</p>
        <div className="mt-4 border-t border-line pt-4">
          <StockAdjust dessertId={dessert.id} unitLabel="pieces" />
        </div>
      </div>

      <form action={updateDessert} className="card flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="id" value={dessert.id} />
        <div className="min-w-40 flex-1">
          <label className="label">Name</label>
          <input name="name" defaultValue={dessert.name} className="input" />
        </div>
        <div className="w-32">
          <label className="label">Price (LYD)</label>
          <input
            name="price"
            defaultValue={formatDirhams(dessert.priceDirhams)}
            inputMode="decimal"
            className="input"
          />
        </div>
        <div className="w-32">
          <label className="label">Warn below</label>
          <input
            name="reorderLevel"
            defaultValue={dessert.reorderLevel || ''}
            inputMode="numeric"
            className="input"
          />
        </div>
        <label className="flex items-center gap-2 py-2.5 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={dessert.active}
            className="size-4 accent-brand"
          />
          Still selling
        </label>
        <button type="submit" className="btn-secondary">
          Save
        </button>
      </form>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recipe for one piece</h2>
          <Link href={`/recipes/${dessert.id}`} className="text-sm font-medium text-brand hover:underline">
            Edit recipe
          </Link>
        </div>
        {dessert.recipeLines.length === 0 ? (
          <p className="mt-2 text-sm text-warn">
            No recipe yet, so baking this will not take anything out of ingredient stock.
          </p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {dessert.recipeLines.map((line) => (
              <li key={line.id} className="flex justify-between border-b border-line/60 py-1.5">
                <span>{line.ingredient.name}</span>
                <span className="num text-muted">
                  {formatQuantity(line.quantity, line.ingredient.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card table-wrap">
        <h2 className="border-b border-line px-4 py-3 font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            Nothing yet. Record a baking run to add pieces.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th className="text-right">Change</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap">{formatDate(row.at)}</td>
                  <td>{STOCK_REASON_LABELS[row.reason]}</td>
                  <td
                    className={`num whitespace-nowrap text-right font-medium ${
                      row.delta >= 0 ? 'text-good' : 'text-bad'
                    }`}
                  >
                    {row.delta >= 0 ? '+' : '−'}
                    {Math.abs(row.delta)} pcs
                  </td>
                  <td className="text-muted">{row.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
