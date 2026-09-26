import { renderToBuffer } from '@react-pdf/renderer'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildLoanReport, loadReceiptImages, parseRange } from '@/lib/loan-report'
import { LoanReportDocument, type ReceiptImage } from '@/lib/loan-pdf'
import { resolveShareLink } from '@/lib/share'

// PDF rendering needs Node APIs, so this route never runs on the edge.
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  const session = await getSession()
  let range = parseRange(url.searchParams.get('from'), url.searchParams.get('to'))

  if (!session) {
    const link = token ? await resolveShareLink(token) : null
    if (!link) return new Response('Not found', { status: 404 })
    // A shared download is pinned to the link's own range, never the URL's.
    range = { from: link.fromDate, to: link.toDate }
  }

  const report = await buildLoanReport(range)

  const imageIds = report.purchases.flatMap((purchase) =>
    purchase.receipts.filter((r) => r.mimeType.startsWith('image/')).map((r) => r.id),
  )
  const loaded = await loadReceiptImages(imageIds)

  const images: ReceiptImage[] = []
  report.purchases.forEach((purchase, index) => {
    for (const receipt of purchase.receipts) {
      const image = loaded.get(receipt.id)
      if (!image) continue
      images.push({
        purchaseIndex: index + 1,
        date: purchase.date,
        supplier: purchase.supplierName ?? 'No supplier',
        src: `data:${image.mimeType};base64,${Buffer.from(image.data).toString('base64')}`,
      })
    }
  })

  const owner = await prisma.user.findFirst({ select: { name: true } })

  const buffer = await renderToBuffer(
    LoanReportDocument({ report, shopName: owner?.name ?? 'Dessert shop', images }),
  )

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="purchase-record-${stamp()}.pdf"`,
    },
  })
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10)
}
