/**
 * OnboardingModal — first-login platform selection modal.
 *
 * STORY-028 AC-2, AC-3, AC-5, AC-6, AC-10
 * CLAUDE.md Rule 10: Non-dismissible via ESC or backdrop click (same pattern as ConfirmDialog).
 * CLAUDE.md Rule 1: No <form> tags — uses onClick + controlled state.
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useSession } from '@/contexts/SessionContext'

// AC-3: exact payload per platform
interface PlatformConfig {
  label: string
  name: string
  platform_type: string
  base_currency: string
  emoji: string
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  { label: 'Alpaca', name: 'Alpaca Portfolio', platform_type: 'alpaca', base_currency: 'USD', emoji: '🦙' },
  { label: 'BITKUB', name: 'BITKUB', platform_type: 'bitkub', base_currency: 'THB', emoji: '₿' },
  { label: 'InnovestX', name: 'InnovestX', platform_type: 'innovestx', base_currency: 'THB', emoji: '📈' },
  { label: 'Schwab', name: 'Charles Schwab', platform_type: 'schwab', base_currency: 'USD', emoji: '🏦' },
  { label: 'Webull', name: 'Webull', platform_type: 'webull', base_currency: 'USD', emoji: '🐂' },
  // AC-3: DIME → platform_type "manual", base_currency "THB". PlatformBadge shows "DIME" based on silo name.
  { label: 'DIME', name: 'DIME', platform_type: 'manual', base_currency: 'THB', emoji: '💎' },
]

interface Props {
  open: boolean
}

export function OnboardingModal({ open }: Props) {
  const router = useRouter()
  const { refreshProfile, setSiloCount } = useSession()

  const [selected, setSelected] = useState<PlatformConfig | null>(null)
  // "Other" state
  const [isOther, setIsOther] = useState(false)
  const [otherName, setOtherName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canCreate = selected !== null || (isOther && otherName.trim().length > 0)

  // AC-5: skip → mark onboarded, close modal, stay on /overview
  const handleSkip = async () => {
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarded: true }),
      })
      await refreshProfile()
    } catch {
      // Non-fatal: optimistic close is fine; next login will retry
      await refreshProfile()
    }
  }

  // AC-3, AC-4: create silo → mark onboarded → navigate to new silo
  const handleCreate = async () => {
    if (!canCreate) return
    setIsSubmitting(true)

    try {
      // Build payload
      const payload = isOther
        ? { name: otherName.trim(), platform_type: 'manual', base_currency: 'USD' }
        : { name: selected!.name, platform_type: selected!.platform_type, base_currency: selected!.base_currency }

      const siloRes = await fetch('/api/silos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!siloRes.ok) {
        const err = await siloRes.json().catch(() => ({}))
        const msg = err?.error?.message ?? 'Failed to create silo'
        toast.error(msg)
        setIsSubmitting(false)
        return
      }

      const newSilo = await siloRes.json()

      // Mark onboarded server-side (AC-6)
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarded: true }),
      })

      // Update SessionContext so modal disappears and banner can appear
      setSiloCount(1)
      await refreshProfile()

      // AC-4: navigate to the new silo
      router.push(`/silos/${newSilo.id}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  const handleSelectPlatform = (config: PlatformConfig) => {
    setSelected(config)
    setIsOther(false)
  }

  const handleSelectOther = () => {
    setSelected(null)
    setIsOther(true)
  }

  return (
    // AC-10: No onOpenChange — non-dismissible (same as CLAUDE.md Rule 10 / ConfirmDialog)
    <Dialog open={open}>
      <DialogContent
        className="max-w-lg"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to Rebalancify</DialogTitle>
          <DialogDescription>
            Which platform do you invest on first? We&apos;ll set up your portfolio silo.
          </DialogDescription>
        </DialogHeader>

        {/* AC-2: 7 platform cards */}
        <div className="grid grid-cols-3 gap-3 py-2">
          {PLATFORM_CONFIGS.map((config) => {
            const isActive = !isOther && selected?.label === config.label
            return (
              <button
                key={config.label}
                onClick={() => handleSelectPlatform(config)}
                className={[
                  'flex flex-col items-center gap-2 p-4 rounded-md border text-sm font-medium transition-colors',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card hover:bg-secondary',
                ].join(' ')}
                aria-pressed={isActive}
              >
                <span className="text-2xl" aria-hidden="true">{config.emoji}</span>
                {config.label}
              </button>
            )
          })}
        </div>

        {/* AC-2: "Other" option as full-width row */}
        <button
          onClick={handleSelectOther}
          className={[
            'w-full flex items-center gap-2 px-4 py-3 rounded-md border text-sm font-medium transition-colors',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isOther
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card hover:bg-secondary',
          ].join(' ')}
          aria-pressed={isOther}
        >
          + Other platform (enter manually)
        </button>

        {/* Name input for "Other" */}
        {isOther && (
          <div className="flex flex-col gap-1">
            <label htmlFor="other-name" className="text-sm font-medium">
              Portfolio name
            </label>
            <input
              id="other-name"
              type="text"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="e.g. My Brokerage"
              maxLength={80}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}

        {/* CLAUDE.md Rule 13: colour-blind safe — non-colour signal on the selection state */}
        {canCreate && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            You can add more silos later from the Silos page (up to 5 total).
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {/* AC-5: Skip — left-aligned, ghost style */}
          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip for now
          </button>

          {/* Create silo — right-aligned, primary */}
          <button
            onClick={handleCreate}
            disabled={!canCreate || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Creating…' : 'Create silo'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
