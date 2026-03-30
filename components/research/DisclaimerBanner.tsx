import { AlertCircle } from 'lucide-react'

const DISCLAIMER_TEXT =
  'This platform provides data aggregation and decision-support only. Nothing on this page constitutes financial advice. Consult a licensed financial advisor before making investment decisions.'

export function DisclaimerBanner() {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-bg px-4 py-3 text-warning text-sm"
      role="note"
      aria-label="Financial disclaimer"
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm">{DISCLAIMER_TEXT}</p>
    </div>
  )
}

