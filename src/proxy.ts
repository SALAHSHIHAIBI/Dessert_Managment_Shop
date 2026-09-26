import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/session'

// Routes reachable without signing in: the login and first-time setup pages,
// and the read-only share links handed to the loan officer.
const PUBLIC_PREFIXES = ['/login', '/setup', '/share']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (token && (await verifySession(token))) {
    return NextResponse.next()
  }

  // This is an optimistic check only; every page and server action verifies the
  // session again on the server before touching data.
  const loginUrl = new URL('/login', request.url)
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.png).*)'],
}
