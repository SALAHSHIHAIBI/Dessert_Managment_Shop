import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { STOCK_REASON_LABELS, formatDate } from '@/lib/format'
import { getIngredientStock } from '@/lib/stock'
import { formatQuantity, fromMilli, unitLabel } from '@/lib/units'
import { PageHeader } from '@/components/page-header'
import { StockAdjust } from '@/components/stock-adjust'
import { updateIngredient } from '../../actions'

export default async function IngredientPage({ params }: PageProps<'/inventory/ingredient/[id]'>) {
  await requireSession()
  const { id } = await params

  const ingredient = await prisma.ingredient.findUnique({ where: { id } })
  if (!ingredient) notFound()

  const history = await prisma.stockLog.findMany({
    where: { ingredientId: id },
    orderBy: [{ at: 'desc' }, { id: 'desc' }],
    include: {
      purchase: { select: { id: true, supplierName: true } },
      production: { select: { id: true, dessert: { select: { name: true } } } },
    },
    take: 100,
  })

  // Summed over every entry, not just the hundred shown below.
  const level = (await getIngredientStock([id])).get(id) ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={ingredient.name}
        subtitle={`Measured in ${unitLabel(ingredient.unit)}`}
        action={
          <Link href="/inventory" className="btn-secondary">
            Back to inventory
          </Link>
        }
      />

      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">In stock now</p>
        <p className="num mt-1 text-3xl font-bold">
          {formatQuantity(level, ingredient.unit)}
        </p>
        <div className="mt-4 border-t border-line pt-4">
          <StockAdjust ingredientId={ingredient.id} unitLabel={unitLabel(ingredient.unit)} />
        </div>
      </div>

      <form action={updateIngredient} className="card flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="id" value={ingredient.id} />
        <div className="min-w-40 flex-1">
          <label className="label">Name</label>
          <input name="name" defaultValue={ingredient.name} className="input" />
        </div>
        <div className="w-40">
          <label className="label">Warn below ({unitLabel(ingredient.unit)})</label>
          <input
            name="reorderLevel"
            defaultValue={ingredient.reorderLevel ? fromMilli(ingredient.reorderLevel) : ''}
            inputMode="decimal"
            className="input"
          />
        </div>
        <button type="submit" className="btn-secondary">
          Save
        </button>
      </form>

      <section className="card table-wrap">
        <h2 className="border-b border-line px-4 py-3 font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            Nothing yet. Stock arrives when a purchase line is linked to this ingredient.
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
                    {formatQuantity(Math.abs(row.delta), ingredient.unit)}
                  </td>
                  <td className="text-muted">
                    {row.purchase ? (
                      <Link href={`/purchases/${row.purchase.id}`} className="hover:text-brand">
                        {row.purchase.supplierName ?? 'Purchase'}
                      </Link>
                    ) : row.production ? (
                      `Made ${row.production.dessert.name}`
                    ) : (
                      (row.note ?? '—')
                    )}
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
