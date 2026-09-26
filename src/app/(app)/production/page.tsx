import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getIngredientStock } from '@/lib/stock'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/page-header'
import { ProductionForm, type DessertWithRecipe } from '@/components/production-form'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { deleteProduction } from './actions'

export default async function ProductionPage() {
  await requireSession()

  const [desserts, stock, recent] = await Promise.all([
    prisma.dessert.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { recipeLines: { include: { ingredient: true } } },
    }),
    getIngredientStock(),
    prisma.production.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { dessert: { select: { name: true } } },
      take: 30,
    }),
  ])

  const options: DessertWithRecipe[] = desserts.map((dessert) => ({
    id: dessert.id,
    name: dessert.name,
    recipe: dessert.recipeLines.map((line) => ({
      name: line.ingredient.name,
      quantity: line.quantity,
      unit: line.ingredient.unit,
      inStock: stock.get(line.ingredientId) ?? 0,
    })),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production"
        subtitle="Record a baking run. Ingredients come out of stock, finished pieces go in."
      />

      <ProductionForm desserts={options} />

      <section className="card table-wrap">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Recent batches</h2>
        {recent.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No batches recorded yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Dessert</th>
                <th className="text-right">Pieces</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recent.map((run) => (
                <tr key={run.id}>
                  <td className="whitespace-nowrap">{formatDate(run.date)}</td>
                  <td className="font-medium">{run.dessert.name}</td>
                  <td className="num text-right">{run.quantity}</td>
                  <td className="text-muted">{run.notes ?? '—'}</td>
                  <td className="text-right">
                    <form action={deleteProduction}>
                      <input type="hidden" name="id" value={run.id} />
                      <ConfirmSubmit
                        className="text-sm text-muted hover:text-bad"
                        message="Undo this batch? Ingredients go back and the pieces are removed."
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
