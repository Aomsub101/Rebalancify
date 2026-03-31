'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PLATFORM_DEFAULT_CURRENCY } from '@/lib/silos'
import type { PlatformType } from '@/lib/silos'

const PLATFORM_OPTIONS: { value: PlatformType; label: string; description: string }[] = [
  { value: 'alpaca', label: 'Alpaca', description: 'US stocks & ETFs via Alpaca API' },
  { value: 'bitkub', label: 'BITKUB', description: 'Thai crypto exchange' },
  { value: 'innovestx', label: 'InnovestX', description: 'Thai equities & digital assets' },
  { value: 'schwab', label: 'Charles Schwab', description: 'US stocks & ETFs via Schwab OAuth' },
  { value: 'webull', label: 'Webull', description: 'US & global stocks' },
  { value: 'manual', label: 'Manual', description: 'Enter holdings manually — any platform' },
]

export default function NewSiloPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [platformType, setPlatformType] = useState<PlatformType>('alpaca')
  const [baseCurrency, setBaseCurrency] = useState<string>('USD')
  const [driftThreshold, setDriftThreshold] = useState<string>('5')
  const [cashBalance, setCashBalance] = useState<string>('0')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePlatformChange(platform: PlatformType) {
    setPlatformType(platform)
    setBaseCurrency(PLATFORM_DEFAULT_CURRENCY[platform])
  }

  async function handleCreate() {
    setError(null)

    if (!name.trim()) {
      setError('Silo name is required.')
      return
    }

    const threshold = parseFloat(driftThreshold)
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      setError('Drift threshold must be between 0 and 100.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/silos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          platform_type: platformType,
          base_currency: baseCurrency,
          drift_threshold: threshold,
          cash_balance: cashBalance || '0.00000000',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data?.error?.code === 'SILO_LIMIT_REACHED') {
          setError('You have reached the maximum of 5 active silos.')
        } else {
          setError(data?.error?.message ?? 'Failed to create silo.')
        }
        return
      }

      // Invalidate silos and profile queries to reactively update SiloCountBadge (AC #11)
      await queryClient.invalidateQueries({ queryKey: ['silos'] })
      await queryClient.invalidateQueries({ queryKey: ['profile'] })

      toast.success(`Silo "${data.name}" created.`)
      router.push('/silos')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Back navigation */}
      <Link
        href="/silos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to Silos
      </Link>

      <h1 className="text-3xl font-semibold text-foreground mb-8">Create silo</h1>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-negative/30 bg-negative-bg px-4 py-3 text-negative text-sm mb-6"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Silo name */}
        <div>
          <label
            htmlFor="silo-name"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Silo name <span className="text-negative" aria-hidden="true">*</span>
          </label>
          <input
            id="silo-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Alpaca Portfolio"
            maxLength={100}
            className={cn(
              'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
              'placeholder:text-muted-foreground',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
        </div>

        {/* Platform type (AC #9 — all 6 options) */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            Platform <span className="text-negative" aria-hidden="true">*</span>
          </p>
          <div className="space-y-2">
            {PLATFORM_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  'outline-none focus-within:ring-2 focus-within:ring-ring',
                  platformType === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <input
                  type="radio"
                  name="platform_type"
                  value={option.value}
                  checked={platformType === option.value}
                  onChange={() => handlePlatformChange(option.value)}
                  className="mt-0.5 accent-primary outline-none"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">{option.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Base currency — pre-filled per platform (AC #9) */}
        <div>
          <label
            htmlFor="base-currency"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Base currency
          </label>
          <input
            id="base-currency"
            type="text"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value.toUpperCase().slice(0, 3))}
            maxLength={3}
            className={cn(
              'w-32 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground uppercase',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
          <p className="text-xs text-muted-foreground mt-1">3-letter currency code (e.g. USD, THB)</p>
        </div>

        {/* Drift threshold */}
        <div>
          <label
            htmlFor="drift-threshold"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Drift alert threshold (%)
          </label>
          <input
            id="drift-threshold"
            type="number"
            value={driftThreshold}
            onChange={(e) => setDriftThreshold(e.target.value)}
            min={0}
            max={100}
            step={0.5}
            className={cn(
              'w-28 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Alert when any asset drifts more than this % from its target weight.
          </p>
        </div>

        {/* Cash balance — manual silos only */}
        {platformType === 'manual' && (
          <div>
            <label
              htmlFor="cash-balance"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Cash balance ({baseCurrency})
            </label>
            <input
              id="cash-balance"
              type="number"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.target.value)}
              min={0}
              step={0.01}
              placeholder="0.00"
              className={cn(
                'w-40 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground',
                'placeholder:text-muted-foreground',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label="Cash balance"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Starting cash held in this silo (not invested in any asset).
            </p>
          </div>
        )}

        {/* Actions — no form tag per CLAUDE.md Rule 1 */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/silos"
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium text-foreground hover:bg-secondary transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            Cancel
          </Link>
          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSubmitting ? 'Creating…' : 'Create silo'}
          </button>
        </div>
      </div>

      {/* Disclaimer — CLAUDE.md Rule 14 */}
      <p className="mt-12 text-xs text-muted-foreground text-center">
        This is not financial advice.
      </p>
    </div>
  )
}
