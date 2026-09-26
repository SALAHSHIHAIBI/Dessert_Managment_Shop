import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/page-header'
import { RecipeEditor } from '@/components/recipe-editor'

export default async function RecipePage({ params }: PageProps<'/recipes/[dessertId]'>) {
  await requireSession()
  const { dessertId } = await params

  const [dessert, ingredients] = await Promise.all([
    prisma.dessert.findUnique({ where: { id: dessertId }, include: { recipeLines: true } }),
    prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true },
    }),
  ])
  if (!dessert) notFound()

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Recipe: ${dessert.name}`}
        action={
          <Link href="/recipes" className="btn-secondary">
            All recipes
          </Link>
        }
      />
      <RecipeEditor
        dessertId={dessert.id}
        dessertName={dessert.name}
        ingredients={ingredients}
        initialLines={dessert.recipeLines.map((line) => ({
          ingredientId: line.ingredientId,
          quantity: line.quantity,
        }))}
      />
    </div>
  )
}
