import ExcelJS from 'exceljs'
import { getSession } from '@/lib/auth'
import { buildLoanReport, parseRange } from '@/lib/loan-report'
import { resolveShareLink } from '@/lib/share'
import { CATEGORY_LABELS, PAYMENT_LABELS, formatDate } from '@/lib/format'
import { DIRHAMS_PER_DINAR } from '@/lib/units'
import type { PaymentMethod } from '@/generated/prisma/enums'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  const session = await getSession()
  let range = parseRange(url.searchParams.get('from'), url.searchParams.get('to'))

  if (!session) {
    const link = token ? await resolveShareLink(token) : null
    if (!link) return new Response('Not found', { status: 404 })
    range = { from: link.fromDate, to: link.toDate }
  }

  const report = await buildLoanReport(range)
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()

  // Amounts are written as real numbers in dinars, so the reader can total and
  // filter them in Excel rather than retyping anything.
  const toDinars = (dirhams: number) => dirhams / DIRHAMS_PER_DINAR
  const MONEY = '#,##0.00'

  const purchases = workbook.addWorksheet('Purchases')
  purchases.columns = [
    { header: '#', key: 'no', width: 6 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Supplier', key: 'supplier', width: 26 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Paid by', key: 'payment', width: 14 },
    { header: 'Details', key: 'details', width: 40 },
    { header: 'Amount (LYD)', key: 'amount', width: 15, style: { numFmt: MONEY } },
    { header: 'Receipts', key: 'receipts', width: 10 },
  ]
  purchases.getRow(1).font = { bold: true }

  report.purchases.forEach((purchase, index) => {
    purchases.addRow({
      no: index + 1,
      date: formatDate(purchase.date),
      supplier: purchase.supplierName ?? '',
      category: CATEGORY_LABELS[purchase.category],
      payment: PAYMENT_LABELS[purchase.paymentMethod as PaymentMethod],
      details:
        purchase.items.length > 0
          ? purchase.items.map((item) => item.description).join(', ')
          : (purchase.notes ?? ''),
      amount: toDinars(purchase.totalDirhams),
      receipts: purchase.receipts.length,
    })
  })

  const totalRow = purchases.addRow({
    details: 'Total',
    amount: toDinars(report.totalDirhams),
  })
  totalRow.font = { bold: true }

  const summary = workbook.addWorksheet('Summary')
  summary.columns = [
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Purchases', key: 'count', width: 12 },
    { header: 'Amount (LYD)', key: 'amount', width: 15, style: { numFmt: MONEY } },
  ]
  summary.getRow(1).font = { bold: true }
  for (const row of report.byCategory) {
    summary.addRow({
      category: CATEGORY_LABELS[row.category],
      count: row.count,
      amount: toDinars(row.totalDirhams),
    })
  }
  const summaryTotal = summary.addRow({
    category: 'Total',
    count: report.purchases.length,
    amount: toDinars(report.totalDirhams),
  })
  summaryTotal.font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="purchase-record-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`,
    },
  })
}
