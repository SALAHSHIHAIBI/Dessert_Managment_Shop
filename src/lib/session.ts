// Signing and verifying the login cookie.
//
// Kept apart from lib/auth.ts because this module must also run in the Proxy
// (edge) runtime, where bcrypt and the database client are not available.

import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'dessert_session'

type SessionClaims = { userId: string; email: string; name: string }

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) {
    throw new Error('AUTH_SECRET is missing or shorter than 32 characters.')
  }
  return new TextEncoder().encode(value)
}

export async function signSession(claims: SessionClaims, days: number): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret())
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    const { userId, email, name } = payload as Partial<SessionClaims>
    if (!userId || !email || !name) return null
    return { userId, email, name }
  } catch {
    return null
  }
}
