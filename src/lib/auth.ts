import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, signSession, verifySession } from '@/lib/session'

export type Session = { userId: string; email: string; name: string }

const SESSION_DAYS = 30

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/** Reads the login cookie. Returns null when nobody is signed in. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySession(token)
}

/** Use in every page and server action that touches shop data. */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function startSession(session: Session): Promise<void> {
  const token = await signSession(session, SESSION_DAYS)
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function endSession(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}

/** Checks an email/password pair. Returns null when either is wrong. */
export async function authenticate(email: string, password: string): Promise<Session | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user) {
    // Spend roughly the same time as a real check so a missing account cannot
    // be told apart from a wrong password by how fast the answer comes back.
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin')
    return null
  }
  if (!(await verifyPassword(password, user.passwordHash))) return null
  return { userId: user.id, email: user.email, name: user.name }
}

/** True when no owner account has been created yet, so we can offer setup. */
export async function needsSetup(): Promise<boolean> {
  return (await prisma.user.count()) === 0
}
