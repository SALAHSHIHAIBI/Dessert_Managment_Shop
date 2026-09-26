'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseRange } from '@/lib/loan-report'

export type ShareState = { error?: string; token?: string }

export async function createShareLink(
  _prev: ShareState,
  formData: FormData,
): Promise<ShareState> {
  await requireSession()

  try {
    const range = parseRange(
      String(formData.get('from') ?? '') || null,
      String(formData.get('to') ?? '') || null,
    )

    const days = Number(String(formData.get('expiresInDays') ?? '30'))
    const expiresAt =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        : null

    // 32 random bytes: far too many to guess, which is the only thing standing
    // between this link and the purchase records behind it.
    const token = randomBytes(24).toString('base64url')

    await prisma.shareLink.create({
      data: {
        token,
        label: String(formData.get('label') ?? '').trim() || null,
        fromDate: range.from,
        toDate: range.to,
        expiresAt,
      },
    })

    revalidatePath('/loan-report')
    return { token }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not create the link.' }
  }
}

export async function revokeShareLink(formData: FormData) {
  await requireSession()
  const id = String(formData.get('id') ?? '')
  await prisma.shareLink.update({ where: { id }, data: { revokedAt: new Date() } })
  revalidatePath('/loan-report')
}
