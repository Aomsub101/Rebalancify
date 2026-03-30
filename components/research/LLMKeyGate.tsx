import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export function LLMKeyGate() {
  return (
    <div
      className="rounded-lg border border-border bg-card p-6"
      role="alert"
      aria-label="AI Research Hub requires an LLM key"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            To use the Research Hub, add your LLM API key in Settings.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open Settings
          </Link>
        </div>
      </div>
    </div>
  )
}

