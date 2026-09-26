// Fills the database with an example shop — about four months of purchases,
// receipts, baking and sales — so every screen has something real to show.
//
//   npm run seed          fills an empty database, does nothing otherwise
//   npm run seed:reset    wipes everything first, then fills it
//
// Sign in afterwards with owner@example.com / password123

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { receiptPng } from './receipt-image'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const dinars = (value: number) => Math.round(value * 100)
const units = (value: number) => Math.round(value * 1000)
const money = (dirhams: number) => (dirhams / 100).toFixed(2)

const DAYS = 120

/** Day 0 is four months ago, day DAYS is today. Midday UTC, like the app uses. */
function dayDate(day: number): Date {
  const today = new Date()
  return new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - day), 12),
  )
}

function receiptDate(day: number): string {
  return dayDate(day)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

/** A seeded generator, so running the seed twice produces the same shop. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = random(20260919)
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

// ---------------------------------------------------------------- the shop --

const INGREDIENTS = {
  flour: { name: 'Flour', unit: 'KG' as const, price: 4, reorder: 10, packSize: 25 },
  sugar: { name: 'Sugar', unit: 'KG' as const, price: 6, reorder: 8, packSize: 25 },
  semolina: { name: 'Semolina', unit: 'KG' as const, price: 5, reorder: 8, packSize: 25 },
  butter: { name: 'Butter', unit: 'KG' as const, price: 11, reorder: 6, packSize: 5 },
  pistachio: { name: 'Pistachio', unit: 'KG' as const, price: 45, reorder: 2, packSize: 1 },
  honey: { name: 'Honey', unit: 'KG' as const, price: 28, reorder: 1, packSize: 5 },
  roseWater: { name: 'Rose water', unit: 'L' as const, price: 12, reorder: 1, packSize: 2 },
  eggs: { name: 'Eggs', unit: 'PIECE' as const, price: 0.5, reorder: 60, packSize: 30 },
  cardamom: { name: 'Cardamom', unit: 'KG' as const, price: 60, reorder: 0.2, packSize: 1 },
}
type IngredientKey = keyof typeof INGREDIENTS

const DESSERTS = {
  baklava: {
    name: 'Baklava',
    price: 2.5,
    reorder: 40,
    // Per single piece.
    recipe: { flour: 0.05, sugar: 0.03, pistachio: 0.02, butter: 0.02, honey: 0.01 },
    // Roughly how many get made on a normal day.
    dailyBatch: 70,
  },
  basbousa: {
    name: 'Basbousa',
    price: 1.75,
    reorder: 30,
    recipe: { semolina: 0.06, sugar: 0.04, butter: 0.015, roseWater: 0.002 },
    dailyBatch: 50,
  },
  maamoul: {
    name: 'Maamoul',
    price: 3,
    reorder: 25,
    recipe: { flour: 0.05, butter: 0.025, sugar: 0.02, cardamom: 0.0005, eggs: 0.1 },
    dailyBatch: 40,
  },
  kunafa: {
    name: 'Kunafa slice',
    price: 4,
    reorder: 15,
    recipe: { semolina: 0.05, butter: 0.03, sugar: 0.035, pistachio: 0.01 },
    dailyBatch: 25,
  },
  ghraybeh: {
    name: 'Ghraybeh',
    price: 1.5,
    reorder: 30,
    recipe: { flour: 0.04, butter: 0.03, sugar: 0.015 },
    dailyBatch: 45,
  },
}
type DessertKey = keyof typeof DESSERTS

// Baking starts part way through, so the earlier purchases stand alone as the
// equipment-and-setup part of the loan file.
const BAKING_FROM = DAYS - 80

/** Friday and Saturday are the busy days. */
function busyness(day: number): number {
  const weekday = dayDate(day).getUTCDay()
  if (weekday === 5 || weekday === 6) return 1.45
  if (weekday === 0) return 1.1
  return 1
}

async function main() {
  if (process.argv.includes('--reset')) {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE "StockLog","SaleLine","Sale","Production","RecipeLine","Receipt",
      "PurchaseItem","Purchase","Dessert","Ingredient","Supplier","ShareLink","User" CASCADE
    `)
    console.log('Wiped the database.')
  } else if ((await prisma.user.count()) > 0) {
    console.log('An account already exists — leaving the database alone.')
    console.log('Run `npm run seed:reset` to wipe it and start again.')
    return
  }

  await prisma.user.create({
    data: {
      name: 'Salah',
      email: 'owner@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
    },
  })

  const ingredientIds = {} as Record<IngredientKey, string>
  for (const [key, spec] of Object.entries(INGREDIENTS)) {
    const created = await prisma.ingredient.create({
      data: { name: spec.name, unit: spec.unit, reorderLevel: units(spec.reorder) },
    })
    ingredientIds[key as IngredientKey] = created.id
  }

  const dessertIds = {} as Record<DessertKey, string>
  for (const [key, spec] of Object.entries(DESSERTS)) {
    const created = await prisma.dessert.create({
      data: {
        name: spec.name,
        priceDirhams: dinars(spec.price),
        reorderLevel: spec.reorder,
        recipeLines: {
          create: Object.entries(spec.recipe).map(([ingredient, amount]) => ({
            ingredientId: ingredientIds[ingredient as IngredientKey],
            quantity: units(amount),
          })),
        },
      },
    })
    dessertIds[key as DessertKey] = created.id
  }

  // -------------------------------------------------- plan the baking first --
  // Knowing what gets baked is what tells us how much to buy, and when.

  type Batch = { day: number; dessert: DessertKey; quantity: number }
  const batches: Batch[] = []

  for (let day = BAKING_FROM; day <= DAYS; day++) {
    const load = busyness(day)
    for (const key of Object.keys(DESSERTS) as DessertKey[]) {
      const spec = DESSERTS[key]
      // Not everything is baked every day; the smaller lines run less often.
      if (spec.dailyBatch < 45 && rand() < 0.35) continue
      const quantity = Math.round(spec.dailyBatch * load * (0.75 + rand() * 0.5))
      if (quantity > 0) batches.push({ day, dessert: key, quantity })
    }
  }

  // How much of each ingredient gets used on each day.
  const usage: Record<IngredientKey, number[]> = Object.fromEntries(
    (Object.keys(INGREDIENTS) as IngredientKey[]).map((key) => [
      key,
      new Array(DAYS + 1).fill(0),
    ]),
  ) as Record<IngredientKey, number[]>

  for (const batch of batches) {
    for (const [ingredient, amount] of Object.entries(DESSERTS[batch.dessert].recipe)) {
      usage[ingredient as IngredientKey][batch.day] += units(amount) * batch.quantity
    }
  }

  // ------------------------------------------------------- buy the supplies --

  const supplierNames = {
    wholesale: 'Al-Madina Wholesale',
    dairy: 'Green Valley Dairy',
    packaging: 'Souq Al-Jumaa Packaging',
    equipment: 'Tripoli Kitchen Supplies',
  }
  const suppliers = {} as Record<keyof typeof supplierNames, string>
  for (const [key, name] of Object.entries(supplierNames)) {
    const created = await prisma.supplier.create({
      data: {
        name,
        phone: `09${between(1, 4)} ${between(100, 999)} ${between(1000, 9999)}`,
      },
    })
    suppliers[key as keyof typeof supplierNames] = created.id
  }

  let receiptNumber = 10400

  type NewPurchase = {
    day: number
    supplierId?: string
    supplierName: string
    place: string
    category:
      | 'INGREDIENTS'
      | 'EQUIPMENT'
      | 'PACKAGING'
      | 'RENT'
      | 'UTILITIES'
      | 'TRANSPORT'
      | 'SALARIES'
      | 'OTHER'
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'CREDIT'
    notes?: string
    items: Array<{
      description: string
      quantity: number
      unitPriceDirhams: number
      ingredient?: IngredientKey
    }>
    withReceipt: boolean
  }

  const purchases: NewPurchase[] = []

  // Ingredient runs every three weeks, each covering the coming weeks with a
  // margin — except pistachio at the end, left short so the low-stock warning
  // has something real to point at.
  const RUN_DAYS = [BAKING_FROM - 4, BAKING_FROM + 17, BAKING_FROM + 38, BAKING_FROM + 59]

  // What is already on the shelf when each run comes round, so the shop tops up
  // rather than buying the same sacks of flour over and over.
  const onHand = Object.fromEntries(
    (Object.keys(INGREDIENTS) as IngredientKey[]).map((key) => [key, 0]),
  ) as Record<IngredientKey, number>

  RUN_DAYS.forEach((runDay, index) => {
    const until = index + 1 < RUN_DAYS.length ? RUN_DAYS[index + 1] : DAYS + 1
    const isLastRun = index === RUN_DAYS.length - 1

    const items: NewPurchase['items'] = []
    for (const key of Object.keys(INGREDIENTS) as IngredientKey[]) {
      const spec = INGREDIENTS[key]
      const needed = usage[key].slice(Math.max(0, runDay), until).reduce((a, b) => a + b, 0)
      if (needed === 0) continue

      // Buy what the coming weeks need plus a small buffer. Pistachio is the
      // exception on the last run: it is deliberately left short, so the shop
      // ends up genuinely low on it and the warning has something real to say.
      const buffer = isLastRun && key === 'pistachio' ? units(0.6) : needed * 0.12
      const shortfall = needed + buffer - onHand[key]
      if (shortfall <= 0) continue

      const packs = Math.max(1, Math.ceil(shortfall / units(spec.packSize)))
      const quantity = packs * units(spec.packSize)
      onHand[key] += quantity

      items.push({
        description: `${spec.name} ${packs} × ${spec.packSize}${spec.unit === 'PIECE' ? '' : spec.unit.toLowerCase()}`,
        quantity,
        unitPriceDirhams: dinars(spec.price),
        ingredient: key,
      })
    }

    for (const key of Object.keys(INGREDIENTS) as IngredientKey[]) {
      onHand[key] -= usage[key].slice(Math.max(0, runDay), until).reduce((a, b) => a + b, 0)
    }

    purchases.push({
      day: runDay,
      supplierId: suppliers.wholesale,
      supplierName: supplierNames.wholesale,
      place: 'Tripoli, Libya',
      category: 'INGREDIENTS',
      paymentMethod: index % 2 === 0 ? 'CASH' : 'BANK_TRANSFER',
      notes: 'Ingredient run',
      items,
      withReceipt: true,
    })
  })

  // Setting the shop up.
  purchases.push(
    {
      day: 2,
      supplierId: suppliers.equipment,
      supplierName: supplierNames.equipment,
      place: 'Tripoli, Libya',
      category: 'EQUIPMENT',
      paymentMethod: 'BANK_TRANSFER',
      notes: 'Commercial oven, four trays',
      items: [
        { description: 'Commercial oven', quantity: units(1), unitPriceDirhams: dinars(2350) },
      ],
      withReceipt: true,
    },
    {
      day: 5,
      supplierId: suppliers.equipment,
      supplierName: supplierNames.equipment,
      place: 'Tripoli, Libya',
      category: 'EQUIPMENT',
      paymentMethod: 'CASH',
      items: [
        { description: 'Dough mixer 20L', quantity: units(1), unitPriceDirhams: dinars(1180) },
        { description: 'Stainless work table', quantity: units(2), unitPriceDirhams: dinars(310) },
      ],
      withReceipt: true,
    },
    {
      day: 9,
      supplierId: suppliers.equipment,
      supplierName: supplierNames.equipment,
      place: 'Tripoli, Libya',
      category: 'EQUIPMENT',
      paymentMethod: 'CASH',
      notes: 'Paid cash at the shop, receipt lost',
      items: [
        { description: 'Display fridge', quantity: units(1), unitPriceDirhams: dinars(1650) },
      ],
      // Deliberately missing, so the receipt-coverage warning has a real case.
      withReceipt: false,
    },
    {
      day: 12,
      supplierId: suppliers.dairy,
      supplierName: supplierNames.dairy,
      place: 'Zawiya',
      category: 'EQUIPMENT',
      paymentMethod: 'CASH',
      items: [
        { description: 'Baking trays (set of 10)', quantity: units(1), unitPriceDirhams: dinars(420) },
        { description: 'Cooling racks', quantity: units(4), unitPriceDirhams: dinars(65) },
      ],
      withReceipt: true,
    },
  )

  // Packaging, every few weeks.
  for (const day of [14, 41, 68, 95, 112]) {
    purchases.push({
      day,
      supplierId: suppliers.packaging,
      supplierName: supplierNames.packaging,
      place: 'Tripoli, Libya',
      category: 'PACKAGING',
      paymentMethod: 'CASH',
      items: [
        {
          description: `Cake boxes ${between(200, 400)} pcs`,
          quantity: units(between(200, 400)),
          unitPriceDirhams: dinars(0.6),
        },
        {
          description: 'Paper doilies, box',
          quantity: units(between(2, 5)),
          unitPriceDirhams: dinars(18),
        },
      ],
      withReceipt: true,
    })
  }

  // Rent, power and wages, every month.
  for (let month = 0; month < 4; month++) {
    const day = 3 + month * 30
    purchases.push({
      day,
      supplierName: 'Mahmoud Al-Barghathi (landlord)',
      place: 'Tripoli, Libya',
      category: 'RENT',
      paymentMethod: 'CASH',
      notes: 'Shop rent',
      items: [{ description: 'Monthly rent', quantity: units(1), unitPriceDirhams: dinars(900) }],
      withReceipt: month !== 2,
    })
    purchases.push({
      day: day + 8,
      supplierName: 'GECOL',
      place: 'Tripoli, Libya',
      category: 'UTILITIES',
      paymentMethod: 'BANK_TRANSFER',
      items: [
        {
          description: 'Electricity',
          quantity: units(1),
          unitPriceDirhams: dinars(between(120, 260)),
        },
        { description: 'Water', quantity: units(1), unitPriceDirhams: dinars(between(30, 60)) },
      ],
      withReceipt: true,
    })
    purchases.push({
      day: day + 25,
      supplierName: 'Shop wages',
      place: 'Tripoli, Libya',
      category: 'SALARIES',
      paymentMethod: 'CASH',
      notes: 'Two assistants',
      items: [
        { description: 'Assistant wages', quantity: units(2), unitPriceDirhams: dinars(750) },
      ],
      withReceipt: true,
    })
    purchases.push({
      day: day + 17,
      supplierName: 'Ali transport',
      place: 'Tripoli, Libya',
      category: 'TRANSPORT',
      paymentMethod: 'CASH',
      items: [
        {
          description: 'Delivery van fuel and trips',
          quantity: units(1),
          unitPriceDirhams: dinars(between(70, 150)),
        },
      ],
      withReceipt: true,
    })
  }

  purchases.sort((a, b) => a.day - b.day)

  for (const purchase of purchases) {
    const total = purchase.items.reduce(
      (sum, item) => sum + Math.round((item.quantity / 1000) * item.unitPriceDirhams),
      0,
    )
    receiptNumber += between(3, 19)

    const image = purchase.withReceipt
      ? receiptPng({
          shop: purchase.supplierName,
          place: purchase.place,
          phone: purchase.supplierId
            ? `09${between(1, 4)} ${between(1000000, 9999999)}`
            : undefined,
          date: receiptDate(purchase.day),
          number: String(receiptNumber),
          lines: purchase.items.map((item) => ({
            label: item.description,
            amount: money(Math.round((item.quantity / 1000) * item.unitPriceDirhams)),
          })),
          total: money(total),
          paidBy: purchase.paymentMethod.replace('_', ' '),
        })
      : null

    await prisma.purchase.create({
      data: {
        date: dayDate(purchase.day),
        supplierId: purchase.supplierId ?? null,
        supplierName: purchase.supplierName,
        category: purchase.category,
        paymentMethod: purchase.paymentMethod,
        totalDirhams: total,
        notes: purchase.notes ?? null,
        items: {
          create: purchase.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPriceDirhams: item.unitPriceDirhams,
            ingredientId: item.ingredient ? ingredientIds[item.ingredient] : null,
          })),
        },
        ...(image
          ? {
              receipts: {
                create: [
                  {
                    data: image,
                    mimeType: 'image/png',
                    fileName: `receipt-${receiptNumber}.png`,
                    sizeBytes: image.length,
                  },
                ],
              },
            }
          : {}),
        stockLogs: {
          create: purchase.items
            .filter((item) => item.ingredient)
            .map((item) => ({
              at: dayDate(purchase.day),
              ingredientId: ingredientIds[item.ingredient!],
              delta: item.quantity,
              reason: 'PURCHASE' as const,
              note: item.description,
            })),
        },
      },
    })
  }

  // ------------------------------------------------------- bake, then sell --

  for (const batch of batches) {
    const when = dayDate(batch.day)
    const production = await prisma.production.create({
      data: {
        dessertId: dessertIds[batch.dessert],
        quantity: batch.quantity,
        date: when,
      },
    })
    await prisma.stockLog.createMany({
      data: [
        {
          at: when,
          dessertId: dessertIds[batch.dessert],
          delta: batch.quantity,
          reason: 'PRODUCTION_OUTPUT',
          productionId: production.id,
        },
        ...Object.entries(DESSERTS[batch.dessert].recipe).map(([ingredient, amount]) => ({
          at: when,
          ingredientId: ingredientIds[ingredient as IngredientKey],
          delta: -units(amount) * batch.quantity,
          reason: 'PRODUCTION_INPUT' as const,
          productionId: production.id,
          note: `Used making ${DESSERTS[batch.dessert].name}`,
        })),
      ],
    })
  }

  // Sell out of what is actually on the shelf, day by day, so dessert stock
  // never goes negative and what is left over is believable.
  const onShelf = Object.fromEntries(
    (Object.keys(DESSERTS) as DessertKey[]).map((key) => [key, 0]),
  ) as Record<DessertKey, number>

  for (let day = BAKING_FROM; day <= DAYS; day++) {
    for (const batch of batches.filter((b) => b.day === day)) {
      onShelf[batch.dessert] += batch.quantity
    }

    // Most of the day's tray goes, with a little left over. Today is only part
    // way through, so far more of it is still on the shelf.
    const soldShare = day === DAYS ? 0.35 + rand() * 0.15 : 0.78 + rand() * 0.16
    const toSell = Object.fromEntries(
      (Object.keys(DESSERTS) as DessertKey[]).map((key) => [
        key,
        Math.round(onShelf[key] * soldShare),
      ]),
    ) as Record<DessertKey, number>

    const tickets = between(2, 4)
    for (let ticket = 0; ticket < tickets; ticket++) {
      const lastTicket = ticket === tickets - 1
      const lines: Array<{ dessertId: string; quantity: number; unitPriceDirhams: number }> = []

      for (const key of Object.keys(DESSERTS) as DessertKey[]) {
        if (toSell[key] <= 0) continue
        if (!lastTicket && rand() < 0.3) continue
        const quantity = lastTicket
          ? toSell[key]
          : Math.max(1, Math.round((toSell[key] / (tickets - ticket)) * (0.7 + rand() * 0.6)))
        const taken = Math.min(toSell[key], quantity)
        toSell[key] -= taken
        onShelf[key] -= taken
        lines.push({
          dessertId: dessertIds[key],
          quantity: taken,
          unitPriceDirhams: dinars(DESSERTS[key].price),
        })
      }
      if (lines.length === 0) continue

      // Spread the tickets across opening hours.
      const when = dayDate(day)
      when.setUTCHours(9 + ticket * 3, between(0, 59))

      const sale = await prisma.sale.create({
        data: { date: when, lines: { create: lines } },
      })
      await prisma.stockLog.createMany({
        data: lines.map((line) => ({
          at: when,
          dessertId: line.dessertId,
          delta: -line.quantity,
          reason: 'SALE' as const,
          saleId: sale.id,
        })),
      })
    }
  }

  // A little waste, so the history is not suspiciously tidy.
  await prisma.stockLog.create({
    data: {
      at: dayDate(DAYS - 9),
      ingredientId: ingredientIds.butter,
      delta: -units(1.5),
      reason: 'WASTE',
      note: 'Left out overnight in the heat',
    },
  })

  // --------------------------------------------------------------- summary --

  const [purchaseCount, missing, receiptCount, saleCount, batchCount] = await Promise.all([
    prisma.purchase.count(),
    prisma.purchase.count({ where: { receipts: { none: {} } } }),
    prisma.receipt.count(),
    prisma.sale.count(),
    prisma.production.count(),
  ])
  const spent = await prisma.purchase.aggregate({ _sum: { totalDirhams: true } })
  const sold = await prisma.saleLine.findMany({ select: { quantity: true, unitPriceDirhams: true } })

  console.log(`
Example shop ready. Sign in with owner@example.com / password123

  ${purchaseCount} purchases totalling ${money(spent._sum.totalDirhams ?? 0)} LYD
  ${receiptCount} receipt images, ${missing} purchases deliberately left without one
  ${batchCount} baking runs and ${saleCount} sales
  ${money(sold.reduce((sum, l) => sum + l.quantity * l.unitPriceDirhams, 0))} LYD taken over the counter
`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
