import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveShareLink, shareScope } from '@/lib/share'

/**
 * Serves a receipt image out of the database. Reachable either by the signed-in
 * owner, or through a share token — and in that case only when the receipt
 * belongs to a purchase the token is actually allowed to see.
 */
export async function GET(request: Request, { params }: RouteContext<'/api/receipts/[id]'>) {
  const { id } = await params
  const token = new URL(request.url).searchParams.get('token')

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { purchase: { select: { id: true, forLoan: true, date: true } } },
  })
  if (!receipt) return new Response('Not found', { status: 404 })

  if (!(await getSession())) {
    const link = token ? await resolveShareLink(token) : null
    if (!link) return new Response('Not found', { status: 404 })

    const visible = await prisma.purchase.findFirst({
      where: { AND: [{ id: receipt.purchaseId }, shareScope(link)] },
      select: { id: true },
    })
    if (!visible) return new Response('Not found', { status: 404 })
  }

  return new Response(new Uint8Array(receipt.data), {
    headers: {
      'Content-Type': receipt.mimeType,
      'Content-Length': String(receipt.data.length),
      'Content-Disposition': `inline; filename="${encodeURIComponent(receipt.fileName ?? 'receipt')}"`,
      // Private: a receipt is business evidence, never cached by a shared proxy.
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
