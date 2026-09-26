import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDessertStock, getIngredientStock } from '@/lib/stock'
import { startOfMonth, startOfToday } from '@/lib/period'
import { formatMoney, formatQuantity } from '@/lib/units'
import { PageHeader, Stat } from '@/components/page-header'

export default async function DashboardPage() {
  const session = await requireSession()

  const [todayLines, monthPurchases, purchaseCounts, ingredients, desserts] = await Promise.all([
    prisma.saleLine.findMany({
      where: { sale: { date: { gte: startOfToday() } } },
      select: { quantity: true, unitPriceDirhams: true },
    }),
    prisma.purchase.aggregate({
      where: { date: { gte: startOfMonth() } },
      _sum: { totalDirhams: true },
      _count: true,
    }),
    Promise.all([
      prisma.purchase.count(),
      prisma.purchase.count({ where: { receipts: { none: {} } } }),
    ]),
    prisma.ingredient.findMany({ orderBy: { name: 'asc' } }),
    prisma.dessert.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  const [totalPurchases, missingReceipts] = purchaseCounts
  const [ingredientStock, dessertStock] = await Promise.all([
    getIngredientStock(),
    getDessertStock(),
  ])

  const todayMoney = todayLines.reduce((sum, line) => sum + line.quantity * line.unitPriceDirhams, 0)
  const todayPieces = todayLines.reduce((sum, line) => sum + line.quantity, 0)

  const lowIngredients = ingredients
    .map((ingredient) => ({ ...ingredient, level: ingredientStock.get(ingredient.id) ?? 0 }))
    .filter((i) => i.level < 0 || (i.reorderLevel > 0 && i.level <= i.reorderLevel))

  const lowDesserts = desserts
    .map((dessert) => ({ ...dessert, level: dessertStock.get(dessert.id) ?? 0 }))
    .filter((d) => d.level < 0 || (d.reorderLevel > 0 && d.level <= d.reorderLevel))

  const coverage =
    totalPurchases === 0
      ? 100
      : Math.round(((totalPurchases - missingReceipts) / totalPurchases) * 100)

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${session.name}`} subtitle="Here is where the shop stands today." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Sold today"
          value={formatMoney(todayMoney)}
          note={`${todayPieces} ${todayPieces === 1 ? 'piece' : 'pieces'}`}
          tone="brand"
        />
        <Stat
          label="Bought this month"
          value={formatMoney(monthPurchases._sum.totalDirhams ?? 0)}
          note={`${monthPurchases._count} purchases`}
        />
        <Stat
          label="Receipt coverage"
          value={`${coverage}%`}
          tone={coverage === 100 ? 'good' : coverage >= 80 ? 'warn' : 'bad'}
          note={
            missingReceipts === 0
              ? 'Every purchase has one'
              : `${missingReceipts} without a receipt`
          }
        />
        <Stat
          label="Low on stock"
          value={String(lowIngredients.length + lowDesserts.length)}
          tone={lowIngredients.length + lowDesserts.length === 0 ? 'good' : 'warn'}
          note={lowIngredients.length + lowDesserts.length === 0 ? 'Nothing running out' : 'See below'}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Shortcut href="/sales" title="Record a sale" note="Tap what you sold" />
        <Shortcut href="/purchases/new" title="Add a purchase" note="Snap the receipt" />
        <Shortcut href="/production" title="Record a batch" note="What you baked today" />
        <Shortcut href="/loan-report" title="Loan report" note="Export or share it" />
      </div>

      {missingReceipts > 0 ? (
        <p className="card border-bad/30 bg-bad-soft p-4 text-sm text-bad">
          <strong>{missingReceipts}</strong>{' '}
          {missingReceipts === 1 ? 'purchase has' : 'purchases have'} no receipt attached.{' '}
          <Link href="/purchases?missing=1" className="font-semibold underline">
            Fix them now
          </Link>{' '}
          — the loan file is only as good as its receipts.
        </p>
      ) : null}

      {lowIngredients.length > 0 || lowDesserts.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Running low</h2>
          <ul className="space-y-2 text-sm">
            {lowIngredients.map((ingredient) => (
              <li key={ingredient.id} className="flex justify-between gap-4">
                <Link
                  href={`/inventory/ingredient/${ingredient.id}`}
                  className="font-medium hover:text-brand"
                >
                  {ingredient.name}
                </Link>
                <span className={`num ${ingredient.level < 0 ? 'text-bad' : 'text-warn'}`}>
                  {formatQuantity(ingredient.level, ingredient.unit)} left
                </span>
              </li>
            ))}
            {lowDesserts.map((dessert) => (
              <li key={dessert.id} className="flex justify-between gap-4">
                <Link
                  href={`/inventory/dessert/${dessert.id}`}
                  className="font-medium hover:text-brand"
                >
                  {dessert.name}
                </Link>
                <span className={`num ${dessert.level < 0 ? 'text-bad' : 'text-warn'}`}>
                  {dessert.level} pieces left
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Shortcut({ href, title, note }: { href: string; title: string; note: string }) {
  return (
    <Link href={href} className="card p-4 transition-colors hover:border-brand hover:bg-brand-soft">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </Link>
  )
}
