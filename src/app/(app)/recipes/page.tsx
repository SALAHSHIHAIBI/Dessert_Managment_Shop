import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatQuantity } from '@/lib/units'
import { PageHeader } from '@/components/page-header'

export default async function RecipesPage() {
  await requireSession()

  const desserts = await prisma.dessert.findMany({
    orderBy: { name: 'asc' },
    include: { recipeLines: { include: { ingredient: true } } },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recipes"
        subtitle="What each dessert uses. These amounts are what baking takes out of ingredient stock."
      />

      {desserts.length === 0 ? (
        <p className="card p-8 text-center text-muted">
          Add a dessert on the{' '}
          <Link href="/inventory?tab=desserts" className="font-medium text-brand hover:underline">
            Inventory
          </Link>{' '}
          screen first.
        </p>
      ) : (
        <ul className="space-y-3">
          {desserts.map((dessert) => (
            <li key={dessert.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">{dessert.name}</h2>
                <Link href={`/recipes/${dessert.id}`} className="btn-secondary">
                  {dessert.recipeLines.length > 0 ? 'Edit recipe' : 'Add recipe'}
                </Link>
              </div>

              {dessert.recipeLines.length === 0 ? (
                <p className="mt-2 text-sm text-warn">
                  No recipe yet — baking this will not reduce any ingredient.
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {dessert.recipeLines.map((line) => (
                    <li key={line.id} className="badge bg-cream text-muted">
                      {line.ingredient.name}
                      <span className="num font-normal">
                        {formatQuantity(line.quantity, line.ingredient.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
