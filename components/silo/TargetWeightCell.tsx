'use client'

import { useRef, useState } from 'react'
import { formatNumber } from '@/lib/formatNumber'

interface Props {
  assetId: string
  ticker: string
  localValue: string
  onWeightChange: (assetId: string, value: string) => void
}

/**
 * Inline-editable target weight cell (AC5).
 * Editable for ALL silo types (manual and API).
 * Changes are local until the parent saves via PUT /target-weights.
 */
export function TargetWeightCell({ assetId, ticker, localValue, onWeightChange }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(localValue)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync edit value if parent updates localValue (e.g. after save)
  // We only sync when not currently editing
  function startEdit() {
    setEditValue(localValue)
    setIsEditing(true)
  }

  function commitEdit() {
    // Clamp to valid range client-side for immediate feedback
    const parsed = parseFloat(editValue)
    const clamped = isNaN(parsed) ? localValue : String(Math.min(100, Math.max(0, parsed)))
    onWeightChange(assetId, clamped)
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') inputRef.current?.blur()
    if (e.key === 'Escape') {
      setEditValue(localValue)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={100}
        step="0.001"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-20 text-right font-mono text-sm tabular-nums bg-background border border-primary rounded px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Edit target weight for ${ticker}`}
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') startEdit() }}
      className="cursor-pointer hover:text-primary underline decoration-dotted"
      title="Click to edit target weight"
    >
      {formatNumber(parseFloat(localValue) || 0, 'weight')}
    </span>
  )
}
