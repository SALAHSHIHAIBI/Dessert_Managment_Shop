import { redirect } from 'next/navigation'
import { needsSetup } from '@/lib/auth'
import { createOwner } from './actions'
import { SubmitButton } from '@/components/submit-button'

// Whether an owner account exists is a fact about right now, not about build
// time, so this page is never cached as static HTML.
export const dynamic = 'force-dynamic'

export default async function SetupPage({ searchParams }: PageProps<'/setup'>) {
  // Once an owner account exists this page is closed, so nobody can add a
  // second account from the open internet.
  if (!(await needsSetup())) redirect('/login')

  const { error } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold text-brand">Create your account</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          This is the owner account for the shop. It is created once.
        </p>

        {error ? (
          <p className="mb-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {typeof error === 'string' ? error : 'Something went wrong.'}
          </p>
        ) : null}

        <form action={createOwner} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input id="name" name="name" required className="input" />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              className="input"
            />
            <p className="hint">At least 8 characters.</p>
          </div>
          <SubmitButton className="btn-primary w-full">Create account</SubmitButton>
        </form>
      </div>
    </div>
  )
}
