import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Overview | Rebalancify',
}

// Stub page — full implementation in STORY-019 (OverviewPage)
export default function OverviewPage() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Overview coming soon — STORY-019
        </p>
      </div>
      {/* Regulatory disclaimer — required on every page (CLAUDE.md Rule 14) */}
      <footer className="mt-auto pt-6">
        <p className="text-xs text-muted-foreground text-center">
          This is not financial advice.
        </p>
      </footer>
    </div>
  )
}
