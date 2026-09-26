'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/purchases', label: 'Purchases' },
  { href: '/loan-report', label: 'Loan report' },
  { href: '/sales', label: 'Sales' },
  { href: '/production', label: 'Production' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/recipes', label: 'Recipes' },
] as const

function useIsActive() {
  const pathname = usePathname()
  return (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
}

/** Sidebar on wide screens. */
export function SideNav() {
  const isActive = useIsActive()
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 lg:flex">
      <Link href="/" className="mb-4 block px-3 text-lg font-bold text-brand">
        Dessert Shop
      </Link>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive(link.href)
              ? 'bg-brand-soft text-brand'
              : 'text-muted hover:bg-cream hover:text-ink'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

/** Scrollable pill row on phones, so nothing is hidden behind a menu. */
export function TopNav() {
  const isActive = useIsActive()
  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-2 lg:hidden">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            isActive(link.href) ? 'bg-brand text-white' : 'bg-cream text-muted'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
