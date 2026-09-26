'use server'

import { redirect } from 'next/navigation'
import { authenticate, startSession } from '@/lib/auth'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')

  const session = await authenticate(email, password)
  if (!session) {
    redirect(`/login?error=${encodeURIComponent('Wrong email or password.')}`)
  }

  await startSession(session)
  // Only allow returning to a path inside this app, never an outside URL.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/')
}
