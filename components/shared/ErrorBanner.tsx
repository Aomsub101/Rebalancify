import { AlertCircle } from 'lucide-react'

interface Props { message: string }

export function ErrorBanner({ message }: Props) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-negative/30 bg-negative-bg px-4 py-3 text-negative text-sm"
      role="alert"
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
