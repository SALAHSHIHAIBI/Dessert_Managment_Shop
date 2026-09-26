import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from './prisma'
import { getDessertStock, getIngredientStock, recordProduction, recordSale } from './stock'
import { toMilli } from './units'

// These run against the development database. Every row created is tagged with
// one run id and removed afterwards, so a real shop's data is never touched.
const RUN = `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
// Ingredient and dessert names are unique, so each name also carries a counter.
let seq = 0
const name = (label: string) => `${RUN} ${label} ${++seq}`

afterEach(async () => {
  // Sales go first: a dessert that has been sold cannot be deleted, which is
  // the point of the Restrict rule on SaleLine — sales history outlives menus.
  await prisma.sale.deleteMany({
    where: { lines: { some: { dessert: { name: { startsWith: RUN } } } } },
  })
  await prisma.dessert.deleteMany({ where: { name: { startsWith: RUN } } })
  await prisma.ingredient.deleteMany({ where: { name: { startsWith: RUN } } })
})

async function setUpShop() {
  const flour = await prisma.ingredient.create({
    data: { name: name('Flour'), unit: 'KG' },
  })
  const sugar = await prisma.ingredient.create({
    data: { name: name('Sugar'), unit: 'KG' },
  })

  // 10 kg of flour and 5 kg of sugar on the shelf.
  await prisma.stockLog.createMany({
    data: [
      { ingredientId: flour.id, delta: toMilli(10), reason: 'ADJUSTMENT' },
      { ingredientId: sugar.id, delta: toMilli(5), reason: 'ADJUSTMENT' },
    ],
  })

  // One baklava takes 200 g of flour and 50 g of sugar.
  const baklava = await prisma.dessert.create({
    data: {
      name: name('Baklava'),
      priceDirhams: 250,
      recipeLines: {
        create: [
          { ingredientId: flour.id, quantity: toMilli(0.2) },
          { ingredientId: sugar.id, quantity: toMilli(0.05) },
        ],
      },
    },
  })

  return { flour, sugar, baklava }
}

describe('recording a baking run', () => {
  it('takes the recipe out of ingredients and puts pieces in', async () => {
    const { flour, sugar, baklava } = await setUpShop()

    await recordProduction({ dessertId: baklava.id, quantity: 20, date: new Date() })

    const ingredients = await getIngredientStock([flour.id, sugar.id])
    // 10 kg − (20 × 200 g) = 6 kg; 5 kg − (20 × 50 g) = 4 kg.
    expect(ingredients.get(flour.id)).toBe(toMilli(6))
    expect(ingredients.get(sugar.id)).toBe(toMilli(4))

    const desserts = await getDessertStock([baklava.id])
    expect(desserts.get(baklava.id)).toBe(20)
  })

  it('still records the run when an ingredient runs out, and says so', async () => {
    const { flour, baklava } = await setUpShop()

    // 60 pieces needs 12 kg of flour but only 10 kg is on the shelf.
    const result = await recordProduction({
      dessertId: baklava.id,
      quantity: 60,
      date: new Date(),
    })

    expect(result.shortages.map((s) => s.ingredientId)).toContain(flour.id)
    expect(result.shortages.find((s) => s.ingredientId === flour.id)?.shortBy).toBe(toMilli(2))

    const desserts = await getDessertStock([baklava.id])
    expect(desserts.get(baklava.id)).toBe(60)
  })

  it('refuses a batch of zero', async () => {
    const { baklava } = await setUpShop()
    await expect(
      recordProduction({ dessertId: baklava.id, quantity: 0, date: new Date() }),
    ).rejects.toThrow()
  })

  it('leaves ingredients alone when the dessert has no recipe', async () => {
    const plain = await prisma.dessert.create({
      data: { name: name('Plain cake'), priceDirhams: 500 },
    })

    const result = await recordProduction({ dessertId: plain.id, quantity: 5, date: new Date() })

    expect(result.shortages).toHaveLength(0)
    expect((await getDessertStock([plain.id])).get(plain.id)).toBe(5)
  })
})

describe('recording a sale', () => {
  it('takes the pieces sold out of dessert stock', async () => {
    const { baklava } = await setUpShop()
    await recordProduction({ dessertId: baklava.id, quantity: 20, date: new Date() })

    await recordSale({
      date: new Date(),
      lines: [{ dessertId: baklava.id, quantity: 3, unitPriceDirhams: 250 }],
    })

    expect((await getDessertStock([baklava.id])).get(baklava.id)).toBe(17)
  })

  it('does not touch ingredient stock — baking already did', async () => {
    const { flour, baklava } = await setUpShop()
    await recordProduction({ dessertId: baklava.id, quantity: 20, date: new Date() })
    const before = (await getIngredientStock([flour.id])).get(flour.id)

    await recordSale({
      date: new Date(),
      lines: [{ dessertId: baklava.id, quantity: 5, unitPriceDirhams: 250 }],
    })

    expect((await getIngredientStock([flour.id])).get(flour.id)).toBe(before)
  })

  it('refuses a sale with nothing in it', async () => {
    await expect(recordSale({ date: new Date(), lines: [] })).rejects.toThrow()
  })

  it('undoing a sale puts the pieces back', async () => {
    const { baklava } = await setUpShop()
    await recordProduction({ dessertId: baklava.id, quantity: 20, date: new Date() })
    const { saleId } = await recordSale({
      date: new Date(),
      lines: [{ dessertId: baklava.id, quantity: 4, unitPriceDirhams: 250 }],
    })

    await prisma.sale.delete({ where: { id: saleId } })

    expect((await getDessertStock([baklava.id])).get(baklava.id)).toBe(20)
  })
})

describe('stock is the sum of its history', () => {
  it('adds up every entry, whatever the reason', async () => {
    const { flour, baklava } = await setUpShop()
    await recordProduction({ dessertId: baklava.id, quantity: 10, date: new Date() })
    await prisma.stockLog.create({
      data: { ingredientId: flour.id, delta: -toMilli(1), reason: 'WASTE', note: 'spilled' },
    })

    const rows = await prisma.stockLog.findMany({ where: { ingredientId: flour.id } })
    const summed = rows.reduce((total, row) => total + row.delta, 0)

    expect((await getIngredientStock([flour.id])).get(flour.id)).toBe(summed)
    // 10 kg − 2 kg baked − 1 kg spilled.
    expect(summed).toBe(toMilli(7))
  })
})
