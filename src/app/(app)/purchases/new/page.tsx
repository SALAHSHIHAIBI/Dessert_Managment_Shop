import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PurchaseForm } from '@/components/purchase-form'
import { PageHeader } from '@/components/page-header'
import { createPurchase } from '../actions'

export default async function NewPurchasePage() {
  await requireSession()

  const [ingredients, suppliers] = await Promise.all([
    prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true },
    }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add purchase"
        subtitle="Record what you bought and attach the receipt while you still have it."
      />
      <PurchaseForm
        action={createPurchase}
        ingredients={ingredients}
        suppliers={suppliers.map((s) => s.name)}
      />
    </div>
  )
}
