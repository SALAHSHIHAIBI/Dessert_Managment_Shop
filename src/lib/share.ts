import 'server-only'

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export type ActiveShareLink = {
  id: string
  label: string | null
  fromDate: Date | null
  toDate: Date | null
  expiresAt: Date | null
}

/** Returns the link only if it exists, is not revoked and has not expired. */
export async function resolveShareLink(token: string): Promise<ActiveShareLink | null> {
  if (!token) return null
  const link = await prisma.shareLink.findUnique({ where: { token } })
  if (!link || link.revokedAt) return null
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null
  return {
    id: link.id,
    label: link.label,
    fromDate: link.fromDate,
    toDate: link.toDate,
    expiresAt: link.expiresAt,
  }
}

/**
 * The only filter a share link may ever use. Sales, production and stock are
 * not reachable through a token at all — this restricts it to loan purchases
 * inside the link's own date range.
 */
export function shareScope(link: ActiveShareLink): Prisma.PurchaseWhereInput {
  return {
    forLoan: true,
    ...(link.fromDate || link.toDate
      ? {
          date: {
            ...(link.fromDate ? { gte: link.fromDate } : {}),
            ...(link.toDate ? { lte: link.toDate } : {}),
          },
        }
      : {}),
  }
}

export type ListedShareLink = {
  id: string
  token: string
  label: string | null
  fromDate: Date | null
  toDate: Date | null
  expiresAt: Date | null
  expired: boolean
  viewCount: number
}

/**
 * The links still in play, with expiry already worked out. Deciding that here
 * rather than in the page keeps "what time is it" out of rendering.
 */
export async function listShareLinks(): Promise<ListedShareLink[]> {
  const now = Date.now()
  const links = await prisma.shareLink.findMany({
    where: { revokedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  return links.map((link) => ({
    id: link.id,
    token: link.token,
    label: link.label,
    fromDate: link.fromDate,
    toDate: link.toDate,
    expiresAt: link.expiresAt,
    expired: link.expiresAt ? link.expiresAt.getTime() < now : false,
    viewCount: link.viewCount,
  }))
}

export async function noteShareView(linkId: string): Promise<void> {
  await prisma.shareLink.update({
    where: { id: linkId },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  })
}
