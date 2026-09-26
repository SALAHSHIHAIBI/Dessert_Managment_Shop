'use server'

import { redirect } from 'next/navigation'
import { hashPassword, needsSetup, startSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function fail(message: string): never {
  redirect(`/setup?error=${encodeURIComponent(message)}`)
}

export async function createOwner(formData: FormData) {
  // Re-checked on the server: the page being reachable is not proof that no
  // account exists yet.
  if (!(await needsSetup())) redirect('/login')

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!name) fail('Please enter your name.')
  if (!email.includes('@')) fail('Please enter a valid email address.')
  if (password.length < 8) fail('Password must be at least 8 characters.')

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  })

  await startSession({ userId: user.id, email: user.email, name: user.name })
  redirect('/')
}
