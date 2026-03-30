import { ErrorBanner } from '@/components/shared/ErrorBanner'

interface Props {
  riskFactors: string[]
}

export function RiskFactorsCard({ riskFactors }: Props) {
  const normalized = (riskFactors ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 8)

  const insufficient = normalized.length < 2

  return (
    <section className="bg-card border border-border rounded-lg p-5" aria-label="Risk factors">
      <h2 className="text-sm font-medium text-foreground">Key risk factors</h2>

      {insufficient ? (
        <div className="mt-3">
          <ErrorBanner message="Insufficient risk factors returned — try refreshing." />
        </div>
      ) : (
        <ul className="mt-3 list-disc pl-5 space-y-1.5 text-sm text-foreground">
          {normalized.map((item, idx) => (
            <li key={`${idx}-${item.slice(0, 24)}`}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

