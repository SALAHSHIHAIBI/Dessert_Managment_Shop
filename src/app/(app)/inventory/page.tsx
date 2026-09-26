import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDessertStock, getIngredientStock } from '@/lib/stock'
import { formatMoney, formatQuantity, unitLabel } from '@/lib/units'
import { PageHeader } from '@/components/page-header'
import { AddDessertForm, AddIngredientForm } from '@/components/add-item-forms'
import { StockAdjust } from '@/components/stock-adjust'

export default async function InventoryPage({ searchParams }: PageProps<'/inventory'>) {
  await requireSession()
  const params = await searchParams
  const tab = params.tab === 'desserts' ? 'desserts' : 'ingredients'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Ingredients come in from purchases; baking turns them into desserts."
      />

      <div className="flex gap-2">
        <TabLink href="/inventory?tab=ingredients" active={tab === 'ingredients'}>
          Ingredients
        </TabLink>
        <TabLink href="/inventory?tab=desserts" active={tab === 'desserts'}>
          Desserts
        </TabLink>
      </div>

      {tab === 'ingredients' ? <IngredientsTab /> : <DessertsTab />}
    </div>
  )
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
        active ? 'bg-brand text-white' : 'border border-line bg-surface text-muted hover:bg-cream'
      }`}
    >
      {children}
    </Link>
  )
}

async function IngredientsTab() {
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: 'asc' } })
  const stock = await getIngredientStock()

  return (
    <div className="space-y-4">
      <AddIngredientForm />

      {ingredients.length === 0 ? (
        <p className="card p-8 text-center text-muted">
          No ingredients yet. Add the ones you buy most often.
        </p>
      ) : (
        <ul className="space-y-3">
          {ingredients.map((ingredient) => {
            const level = stock.get(ingredient.id) ?? 0
            const low = ingredient.reorderLevel > 0 && level <= ingredient.reorderLevel
            return (
              <li key={ingredient.id} className="card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <Link
                      href={`/inventory/ingredient/${ingredient.id}`}
                      className="font-semibold hover:text-brand"
                    >
                      {ingredient.name}
                    </Link>
                    {ingredient.reorderLevel > 0 ? (
                      <p className="text-xs text-muted">
                        Warn below {formatQuantity(ingredient.reorderLevel, ingredient.unit)}
                      </p>
                    ) : null}
                  </div>
                  <StockPill
                    text={formatQuantity(level, ingredient.unit)}
                    tone={level < 0 ? 'bad' : low ? 'warn' : 'good'}
                  />
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  <StockAdjust ingredientId={ingredient.id} unitLabel={unitLabel(ingredient.unit)} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

async function DessertsTab() {
  const desserts = await prisma.dessert.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { recipeLines: true } } },
  })
  const stock = await getDessertStock()

  return (
    <div className="space-y-4">
      <AddDessertForm />

      {desserts.length === 0 ? (
        <p className="card p-8 text-center text-muted">
          No desserts yet. Add what you sell, then give it a recipe.
        </p>
      ) : (
        <ul className="space-y-3">
          {desserts.map((dessert) => {
            const level = stock.get(dessert.id) ?? 0
            const low = dessert.reorderLevel > 0 && level <= dessert.reorderLevel
            return (
              <li key={dessert.id} className="card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <Link
                      href={`/inventory/dessert/${dessert.id}`}
                      className="font-semibold hover:text-brand"
                    >
                      {dessert.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {formatMoney(dessert.priceDirhams)} each ·{' '}
                      {dessert._count.recipeLines > 0 ? (
                        <Link href="/recipes" className="hover:text-brand">
                          {dessert._count.recipeLines} ingredients in recipe
                        </Link>
                      ) : (
                        <Link href="/recipes" className="text-warn hover:underline">
                          no recipe yet
                        </Link>
                      )}
                    </p>
                  </div>
                  <StockPill
                    text={`${level.toLocaleString('en-US')} pcs`}
                    tone={level < 0 ? 'bad' : low ? 'warn' : 'good'}
                  />
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  <StockAdjust dessertId={dessert.id} unitLabel="pieces" />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function StockPill({ text, tone }: { text: string; tone: 'good' | 'warn' | 'bad' }) {
  const classes = {
    good: 'bg-good-soft text-good',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
  }[tone]
  return <span className={`badge num text-sm ${classes}`}>{text}</span>
}
