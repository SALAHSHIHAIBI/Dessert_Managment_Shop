# Dessert Shop Manager

Libyan sweets — purchases, receipts, sales and inventory in one place.

It does three separate jobs:

1. **Loan file.** Every purchase is recorded with a photo of its receipt. When the government asks
   what the money went on, you hand over a PDF, an Excel file, or a link — no shoebox of paper.
2. **Sales.** Tap what you sold. Nothing here appears in the loan report.
3. **Inventory.** Ingredients and finished desserts, both kept honest by what you buy, bake and sell.

Amounts are in Libyan dinar, stored as whole dirhams (100 dirham = 1 dinar), so nothing is ever a
rounding error.

## How stock moves

| What you record | Ingredients | Desserts |
| --- | --- | --- |
| A purchase, with a line linked to an ingredient | up | — |
| A baking run ("made 20 baklava") | down, by the recipe | up |
| A sale | — | down |
| An adjustment or waste | either way | either way |

Each of these writes a line to the stock history. The level you see is the sum of that history, so
you can always open an item and see exactly what changed it. Nothing is silently overwritten.

## Running it on your laptop

You need [Node.js](https://nodejs.org) and [Docker](https://www.docker.com/products/docker-desktop/).

```bash
npm install
cp .env.example .env # then put a long random string in AUTH_SECRET
npm run db:up        # starts PostgreSQL in Docker on port 5433
npm run db:migrate   # creates the tables
npm run dev          # http://localhost:3000
```

`openssl rand -base64 32` will give you a suitable `AUTH_SECRET`. It signs the
login cookie, so keep it out of the repository — `.env` is already ignored.

Open the address it prints and create your owner account. That page closes itself once an account
exists, so nobody else can add one.

To try it with example data first:

```bash
npm run seed         # owner@example.com / password123
npm run seed:reset   # wipes everything, then fills it again
```

`npm run seed` does nothing if an account already exists, so it cannot overwrite
real data by accident. It builds about four months of a working shop: roughly 30
purchases across every category with drawn receipt images (two deliberately left
without one, so the coverage warning has something to point at), nine
ingredients, five desserts with recipes, and several months of baking and daily
sales — ending with a couple of ingredients genuinely low on stock.

### Using it from your phone while developing

`npm run dev` also prints a **Network** address. Open that on a phone on the same Wi‑Fi to test
taking receipt photos with the camera.

## Putting it online

It deploys to [Vercel](https://vercel.com) as one project.

1. Push this repository to GitHub and import it on Vercel.
2. In the Vercel dashboard, add a **Postgres** database to the project. That sets `DATABASE_URL`
   for you.
3. Add one more environment variable, `AUTH_SECRET` — any random string of 32 characters or more.
   Generate one with `openssl rand -base64 32`.
4. Deploy, then run the migration against the live database once:
   `DATABASE_URL="<the production url>" npx prisma migrate deploy`
5. Open your site and create the owner account.

Receipt photos are stored in the database itself, so there is no file storage to set up. The browser
shrinks each photo to roughly 200 KB before it is uploaded.

## Sharing the loan report

On the **Loan report** screen, pick a date range and either download the PDF/Excel, or create a
share link. That link shows the loan officer the purchases and receipts in its range and nothing
else — no sales, no stock, no way into the app. Switch it off at any time and it stops working
immediately.

## Checking it still works

```bash
npm test             # money maths and the stock rules, against the dev database
npm run lint
npm run build
```

The tests create their own rows and delete them afterwards.

Worth walking through by hand after a change:

- Add a purchase with a receipt photo → it appears in the loan report → the PDF and Excel both
  contain it → the share link shows it, and shows no sales.
- Set a recipe, record a batch → the ingredients drop by the right amount and the pieces go up.
- Tap-sell a dessert → its stock drops and today's total rises.

## How it is put together

| Where | What |
| --- | --- |
| `prisma/schema.prisma` | The database, with the two storage conventions explained at the top |
| `src/lib/units.ts` | Dinars ↔ dirhams, and ingredient quantities. All money passes through here |
| `src/lib/stock.ts` | The stock history and the transactions that write to it |
| `src/lib/loan-report.ts` | One report shape, used by the screen, the PDF, the Excel and the link |
| `src/lib/share.ts` | What a share token is allowed to see |
| `src/app/(app)/` | The signed-in screens |
| `src/app/share/[token]/` | The read-only view for the loan officer |
| `src/proxy.ts` | Sends signed-out visitors to the login page |

Built with Next.js, React, Tailwind and Prisma.
