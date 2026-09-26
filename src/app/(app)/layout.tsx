import { requireSession } from '@/lib/auth'
import { SideNav, TopNav } from '@/components/nav'
import { logout } from './actions'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const session = await requireSession()

  return (
    <div className="flex min-h-full flex-1">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3">
          <span className="text-lg font-bold text-brand lg:hidden">Dessert Shop</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{session.name}</span>
            <form action={logout}>
              <button type="submit" className="text-sm font-medium text-muted hover:text-brand">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <TopNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  )
}
