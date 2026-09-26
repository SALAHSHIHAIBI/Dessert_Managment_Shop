'use client'

import { useActionState, useState } from 'react'
import { createShareLink, revokeShareLink, type ShareState } from '@/app/(app)/loan-report/actions'
import { formatDate } from '@/lib/format'

export type ExistingLink = {
  id: string
  token: string
  label: string | null
  fromDate: Date | null
  toDate: Date | null
  expiresAt: Date | null
  /** Worked out on the server — "now" is not something a render may look up. */
  expired: boolean
  viewCount: number
}

/**
 * Read-only links for the loan officer. Anyone holding the link sees the
 * purchases and receipts inside its date range — and nothing else, no sales,
 * no stock, no way in to the app.
 */
export function ShareLinks({
  links,
  defaultFrom,
  defaultTo,
}: {
  links: ExistingLink[]
  defaultFrom: string
  defaultTo: string
}) {
  const [state, formAction, pending] = useActionState<ShareState, FormData>(createShareLink, {})
  const [copied, setCopied] = useState<string | null>(null)

  const fullUrl = (token: string) =>
    typeof window === 'undefined' ? `/share/${token}` : `${window.location.origin}/share/${token}`

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(fullUrl(token))
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="font-semibold">Share with the loan officer</h2>
      <p className="mb-4 text-sm text-muted">
        A link that shows only these purchases and their receipts. It can be switched off at any
        time.
      </p>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1">
          <label className="label">Label</label>
          <input name="label" placeholder="e.g. Ministry of Economy" className="input" />
        </div>
        <div>
          <label className="label">From</label>
          <input name="from" type="date" defaultValue={defaultFrom} className="input" />
        </div>
        <div>
          <label className="label">To</label>
          <input name="to" type="date" defaultValue={defaultTo} className="input" />
        </div>
        <div className="w-36">
          <label className="label">Expires in</label>
          <select name="expiresInDays" defaultValue="30" className="input">
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="0">Never</option>
          </select>
        </div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Creating…' : 'Create link'}
        </button>
      </form>

      {state.error ? <p className="mt-3 text-sm text-bad">{state.error}</p> : null}

      {links.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {links.map((link) => {
            return (
              <li key={link.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{link.label ?? 'Untitled link'}</p>
                    <p className="truncate text-xs text-muted">
                      {link.fromDate || link.toDate
                        ? `${link.fromDate ? formatDate(link.fromDate) : 'start'} – ${
                            link.toDate ? formatDate(link.toDate) : 'today'
                          }`
                        : 'All purchases'}
                      {' · '}
                      {link.expired
                        ? 'Expired'
                        : link.expiresAt
                          ? `Expires ${formatDate(link.expiresAt)}`
                          : 'No expiry'}
                      {' · '}
                      {link.viewCount === 0
                        ? 'Not opened yet'
                        : `Opened ${link.viewCount} ${link.viewCount === 1 ? 'time' : 'times'}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => copy(link.token)} className="btn-secondary">
                      {copied === link.token ? 'Copied' : 'Copy link'}
                    </button>
                    <form action={revokeShareLink}>
                      <input type="hidden" name="id" value={link.id} />
                      <button type="submit" className="btn-secondary text-bad">
                        Switch off
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
