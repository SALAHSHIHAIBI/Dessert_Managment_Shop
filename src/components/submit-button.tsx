'use client'

import { useFormStatus } from 'react-dom'

/**
 * A submit button that disables itself while the form is being sent, so a slow
 * connection cannot produce two purchases or two sales from one tap.
 */
export function SubmitButton({
  children,
  className = 'btn-primary',
  pendingLabel,
}: {
  children: React.ReactNode
  className?: string
  pendingLabel?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingLabel ?? 'Saving…') : children}
    </button>
  )
}
