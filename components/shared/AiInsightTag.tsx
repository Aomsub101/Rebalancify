import { Sparkles } from 'lucide-react'

interface Props {
  text: string
}

export function AiInsightTag({ text }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
      aria-label="AI insight"
      title={text}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      <span className="truncate max-w-[18rem]">{text}</span>
    </span>
  )
}

