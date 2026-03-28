/**
 * AlpacaLiveBadge
 * Persistent amber LIVE badge — shown when Alpaca silo is in live trading mode.
 * CLAUDE.md Rule 15: cannot be hidden or toggled off by the user.
 * Rule 13: includes AlertCircle icon (non-colour signal for colour-blind users).
 */
import { AlertCircle } from 'lucide-react'

export function AlpacaLiveBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide bg-warning-bg text-warning shrink-0"
      aria-label="Live trading mode active"
    >
      <AlertCircle className="h-3 w-3" aria-hidden="true" />
      LIVE
    </span>
  )
}
