'use client'

import { useFormStatus } from 'react-dom'

/** A submit button that asks before doing something that cannot be undone. */
export function ConfirmSubmit({
  children,
  message,
  className = 'btn-danger',
}: {
  children: React.ReactNode
  message: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault()
      }}
    >
      {pending ? 'Working…' : children}
    </button>
  )
}
