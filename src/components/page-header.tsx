export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Stat({
  label,
  value,
  note,
  tone = 'plain',
}: {
  label: string
  value: string
  note?: string
  tone?: 'plain' | 'good' | 'warn' | 'bad' | 'brand'
}) {
  const toneClass = {
    plain: 'text-ink',
    good: 'text-good',
    warn: 'text-warn',
    bad: 'text-bad',
    brand: 'text-brand',
  }[tone]
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`num mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  )
}
