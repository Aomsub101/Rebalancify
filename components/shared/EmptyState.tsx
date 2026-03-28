import { BarChart2, type LucideIcon } from 'lucide-react'

interface Props {
  title: string
  description: string
  icon?: LucideIcon
}

export function EmptyState({ title, description, icon: Icon = BarChart2 }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-medium text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  )
}
