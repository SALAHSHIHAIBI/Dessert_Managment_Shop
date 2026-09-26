import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession, needsSetup } from '@/lib/auth'
import { login } from './actions'
import { SubmitButton } from '@/components/submit-button'

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  if (await getSession()) redirect('/')
  if (await needsSetup()) redirect('/setup')

  const { error, next } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold text-brand">Dessert Shop</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Sign in to manage your shop.</p>

        {error ? (
          <p className="mb-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {typeof error === 'string' ? error : 'Something went wrong.'}
          </p>
        ) : null}

        <form action={login} className="space-y-4">
          <input type="hidden" name="next" value={typeof next === 'string' ? next : ''} />
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
            />
          </div>
          <SubmitButton className="btn-primary w-full">Sign in</SubmitButton>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/setup" className="hover:text-brand">
            First time here?
          </Link>
        </p>
      </div>
    </div>
  )
}
