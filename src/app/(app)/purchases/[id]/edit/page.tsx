import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PurchaseForm } from '@/components/purchase-form'
import { PageHeader } from '@/components/page-header'
import { updatePurchase } from '../../actions'

export default async function EditPurchasePage({ params }: PageProps<'/purchases/[id]/edit'>) {
  await requireSession()
  const { id } = await params

  const [purchase, ingredients, suppliers] = await Promise.all([
    prisma.purchase.findUnique({ where: { id }, include: { items: true } }),
    prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true },
    }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
  ])
  if (!purchase) notFound()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit purchase"
        subtitle="Any receipts you add here are added to the ones already attached."
      />
      <PurchaseForm
        action={updatePurchase}
        ingredients={ingredients}
        suppliers={suppliers.map((s) => s.name)}
        initial={{
          id: purchase.id,
          date: purchase.date,
          category: purchase.category,
          paymentMethod: purchase.paymentMethod,
          totalDirhams: purchase.totalDirhams,
          supplierName: purchase.supplierName,
          notes: purchase.notes,
          forLoan: purchase.forLoan,
          items: purchase.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPriceDirhams: item.unitPriceDirhams,
            ingredientId: item.ingredientId,
          })),
        }}
      />
    </div>
  )
}
