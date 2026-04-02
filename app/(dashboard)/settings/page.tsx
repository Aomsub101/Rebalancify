'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Eye, EyeOff, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LLM_PROVIDERS, getDefaultModel, getModelsForProvider } from '@/lib/llmProviders'

interface ProfileData {
  id: string
  display_name: string | null
  drift_notif_channel: string
  active_silo_count: number
  silo_limit: number
  alpaca_connected: boolean
  alpaca_mode: string
  bitkub_connected: boolean
  innovestx_equity_connected: boolean
  innovestx_digital_connected: boolean
  schwab_connected: boolean
  schwab_token_expired: boolean
  webull_connected: boolean
  llm_connected: boolean
  llm_provider: string | null
  llm_model: string | null
}

async function fetchProfile(): Promise<ProfileData> {
  const res = await fetch('/api/profile')
  if (!res.ok) throw new Error('Failed to fetch profile')
  return res.json()
}

async function fetchCorpusSize(): Promise<{ size_bytes: number }> {
  const res = await fetch('/api/knowledge/corpus-size')
  if (!res.ok) throw new Error('Failed to fetch corpus size')
  return res.json()
}

type NotifChannel = 'app' | 'email' | 'both'

const NOTIF_OPTIONS: { value: NotifChannel; label: string; description: string }[] = [
  { value: 'app', label: 'In-app only', description: 'Show drift alerts in the notification bell.' },
  { value: 'email', label: 'Email only', description: 'Send drift alerts to your account email.' },
  { value: 'both', label: 'Both', description: 'In-app notifications and email alerts.' },
]

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  })

  // Local editable state — synced from server on load
  const [displayName, setDisplayName] = useState('')
  const [notifChannel, setNotifChannel] = useState<NotifChannel>('both')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingNotif, setIsSavingNotif] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Alpaca state
  const [alpacaKey, setAlpacaKey] = useState('')
  const [alpacaSecret, setAlpacaSecret] = useState('')
  const [alpacaMode, setAlpacaMode] = useState<'paper' | 'live'>('paper')
  const [showAlpacaKey, setShowAlpacaKey] = useState(false)
  const [showAlpacaSecret, setShowAlpacaSecret] = useState(false)
  const [isSavingAlpaca, setIsSavingAlpaca] = useState(false)
  const [alpacaSaved, setAlpacaSaved] = useState(false)

  // InnovestX equity (Settrade) state
  const [invxEquityKey, setInvxEquityKey] = useState('')
  const [invxEquitySecret, setInvxEquitySecret] = useState('')
  const [showInvxEquityKey, setShowInvxEquityKey] = useState(false)
  const [showInvxEquitySecret, setShowInvxEquitySecret] = useState(false)
  const [isSavingInvxEquity, setIsSavingInvxEquity] = useState(false)
  const [invxEquitySaved, setInvxEquitySaved] = useState(false)

  // InnovestX digital asset state
  const [invxDigitalKey, setInvxDigitalKey] = useState('')
  const [invxDigitalSecret, setInvxDigitalSecret] = useState('')
  const [showInvxDigitalKey, setShowInvxDigitalKey] = useState(false)
  const [showInvxDigitalSecret, setShowInvxDigitalSecret] = useState(false)
  const [isSavingInvxDigital, setIsSavingInvxDigital] = useState(false)
  const [invxDigitalSaved, setInvxDigitalSaved] = useState(false)

  // BITKUB state
  const [bitkubKey, setBitkubKey] = useState('')
  const [bitkubSecret, setBitkubSecret] = useState('')
  const [showBitkubKey, setShowBitkubKey] = useState(false)
  const [showBitkubSecret, setShowBitkubSecret] = useState(false)
  const [isSavingBitkub, setIsSavingBitkub] = useState(false)
  const [bitkubSaved, setBitkubSaved] = useState(false)

  // Schwab state — OAuth based, no key input needed
  const [schwabConnected, setSchwabConnected] = useState(false)
  const [schwabTokenExpired, setSchwabTokenExpired] = useState(false)

  // Webull state
  const [webullKey, setWebullKey] = useState('')
  const [webullSecret, setWebullSecret] = useState('')
  const [showWebullKey, setShowWebullKey] = useState(false)
  const [showWebullSecret, setShowWebullSecret] = useState(false)
  const [isSavingWebull, setIsSavingWebull] = useState(false)
  const [webullSaved, setWebullSaved] = useState(false)

  // LLM state — STORY-030
  const [llmProvider, setLlmProvider] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [llmKey, setLlmKey] = useState('')
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [isSavingLlm, setIsSavingLlm] = useState(false)
  const [llmSaved, setLlmSaved] = useState(false)
  const [llmValidationError, setLlmValidationError] = useState<string | null>(null)

  const { data: corpusSize } = useQuery({
    queryKey: ['corpusSize'],
    queryFn: fetchCorpusSize,
  })

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setNotifChannel((profile.drift_notif_channel as NotifChannel) ?? 'both')
      setAlpacaMode((profile.alpaca_mode as 'paper' | 'live') ?? 'paper')
      // After load, reset input fields — saved keys are masked as ••••••••
      setAlpacaSaved(profile.alpaca_connected)
      setBitkubSaved(profile.bitkub_connected)
      setInvxEquitySaved(profile.innovestx_equity_connected)
      setInvxDigitalSaved(profile.innovestx_digital_connected)
      setSchwabConnected(profile.schwab_connected)
      setSchwabTokenExpired(profile.schwab_token_expired)
      setWebullSaved(profile.webull_connected)
      setLlmSaved(profile.llm_connected)
      if (profile.llm_provider) setLlmProvider(profile.llm_provider)
      if (profile.llm_model) setLlmModel(profile.llm_model)
    }
  }, [profile])

  async function patchProfile(fields: Record<string, unknown>) {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error?.message ?? 'Update failed')
    return data
  }

  async function handleSignOut() {
    window.location.assign('/api/auth/signout')
  }

  async function handleSaveDisplayName() {
    setSaveError(null)
    setIsSavingProfile(true)
    try {
      await patchProfile({ display_name: displayName.trim() || null })
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Display name saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save display name.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleSaveNotifChannel() {
    setSaveError(null)
    setIsSavingNotif(true)
    try {
      await patchProfile({ drift_notif_channel: notifChannel })
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Notification preference saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save notification preference.')
    } finally {
      setIsSavingNotif(false)
    }
  }

  async function handleSaveAlpaca() {
    setSaveError(null)
    setIsSavingAlpaca(true)
    try {
      const fields: Record<string, unknown> = { alpaca_mode: alpacaMode }
      // Only include key/secret if the user typed something new
      if (alpacaKey.trim()) fields.alpaca_key = alpacaKey.trim()
      if (alpacaSecret.trim()) fields.alpaca_secret = alpacaSecret.trim()
      await patchProfile(fields)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      // Clear plaintext inputs after save — CLAUDE.md Rule 16
      setAlpacaKey('')
      setAlpacaSecret('')
      setShowAlpacaKey(false)
      setShowAlpacaSecret(false)
      setAlpacaSaved(true)
      toast.success('Alpaca settings saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save Alpaca settings.')
    } finally {
      setIsSavingAlpaca(false)
    }
  }

  async function handleSaveInvxEquity() {
    setSaveError(null)
    setIsSavingInvxEquity(true)
    try {
      const fields: Record<string, unknown> = {}
      if (invxEquityKey.trim()) fields.innovestx_key = invxEquityKey.trim()
      if (invxEquitySecret.trim()) fields.innovestx_secret = invxEquitySecret.trim()
      if (Object.keys(fields).length === 0) return
      await patchProfile(fields)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      setInvxEquityKey('')
      setInvxEquitySecret('')
      setShowInvxEquityKey(false)
      setShowInvxEquitySecret(false)
      setInvxEquitySaved(true)
      toast.success('InnovestX equity credentials saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save InnovestX equity credentials.')
    } finally {
      setIsSavingInvxEquity(false)
    }
  }

  async function handleSaveInvxDigital() {
    setSaveError(null)
    setIsSavingInvxDigital(true)
    try {
      const fields: Record<string, unknown> = {}
      if (invxDigitalKey.trim()) fields.innovestx_digital_key = invxDigitalKey.trim()
      if (invxDigitalSecret.trim()) fields.innovestx_digital_secret = invxDigitalSecret.trim()
      if (Object.keys(fields).length === 0) return
      await patchProfile(fields)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      setInvxDigitalKey('')
      setInvxDigitalSecret('')
      setShowInvxDigitalKey(false)
      setShowInvxDigitalSecret(false)
      setInvxDigitalSaved(true)
      toast.success('InnovestX digital asset credentials saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save InnovestX digital credentials.')
    } finally {
      setIsSavingInvxDigital(false)
    }
  }

  async function handleSaveBitkub() {
    setSaveError(null)
    setIsSavingBitkub(true)
    try {
      const fields: Record<string, unknown> = {}
      if (bitkubKey.trim()) fields.bitkub_key = bitkubKey.trim()
      if (bitkubSecret.trim()) fields.bitkub_secret = bitkubSecret.trim()
      if (Object.keys(fields).length === 0) return
      await patchProfile(fields)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      setBitkubKey('')
      setBitkubSecret('')
      setShowBitkubKey(false)
      setShowBitkubSecret(false)
      setBitkubSaved(true)
      toast.success('BITKUB credentials saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save BITKUB credentials.')
    } finally {
      setIsSavingBitkub(false)
    }
  }

  async function handleSaveWebull() {
    setSaveError(null)
    setIsSavingWebull(true)
    try {
      const fields: Record<string, unknown> = {}
      if (webullKey.trim()) fields.webull_key = webullKey.trim()
      if (webullSecret.trim()) fields.webull_secret = webullSecret.trim()
      if (Object.keys(fields).length === 0) return
      await patchProfile(fields)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      setWebullKey('')
      setWebullSecret('')
      setShowWebullKey(false)
      setShowWebullSecret(false)
      setWebullSaved(true)
      toast.success('Webull credentials saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save Webull credentials.')
    } finally {
      setIsSavingWebull(false)
    }
  }

  async function handleSaveLLM() {
    setLlmValidationError(null)
    setSaveError(null)
    if (!llmProvider) {
      setLlmValidationError('Please select a provider.')
      return
    }
    if (!llmKey.trim() && !llmSaved) {
      setLlmValidationError('Please enter your API key.')
      return
    }
    setIsSavingLlm(true)
    try {
      // Validate key first if a new key was entered (AC7)
      if (llmKey.trim()) {
        const validateRes = await fetch('/api/llm/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: llmProvider, key: llmKey.trim() }),
        })
        const validateData = await validateRes.json()
        if (!validateRes.ok || !validateData.valid) {
          setLlmValidationError('Key validation failed — check your API key.')
          return
        }
      }

      const fields: Record<string, unknown> = {
        llm_provider: llmProvider,
        llm_model: llmModel,
      }
      if (llmKey.trim()) fields.llm_key = llmKey.trim()
      await patchProfile(fields)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      setLlmKey('')
      setShowLlmKey(false)
      setLlmSaved(true)
      toast.success('AI Research Hub settings saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save LLM settings.')
    } finally {
      setIsSavingLlm(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 bg-card rounded-lg border border-border animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-negative/30 bg-negative-bg px-4 py-3 text-negative text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Failed to load settings. Please refresh the page.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-semibold text-foreground mb-8">Settings</h1>

      {saveError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-negative/30 bg-negative-bg px-4 py-3 text-negative text-sm mb-6"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {saveError}
        </div>
      )}

      {/* Profile section (AC #10) */}
      <section aria-labelledby="profile-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <h2 id="profile-heading" className="text-xl font-medium text-foreground mb-4">Profile</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="display-name" className="block text-sm font-medium text-foreground mb-1.5">
              Display name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name (optional)"
              maxLength={100}
              className={cn(
                'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
                'placeholder:text-muted-foreground',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
            <p className="text-xs text-muted-foreground mt-1">Shown in the sidebar and emails.</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveDisplayName}
              disabled={isSavingProfile}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
                'hover:bg-primary/90 transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isSavingProfile ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </section>

      {/* Notifications section (AC #10) */}
      <section aria-labelledby="notif-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <h2 id="notif-heading" className="text-xl font-medium text-foreground mb-1">Notifications</h2>
        <p className="text-sm text-muted-foreground mb-4">How to receive drift alerts when an asset exceeds its threshold.</p>

        <div className="space-y-2 mb-4">
          {NOTIF_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                'outline-none focus-within:ring-2 focus-within:ring-ring',
                notifChannel === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:border-primary/40',
              )}
            >
              <input
                type="radio"
                name="drift_notif_channel"
                value={option.value}
                checked={notifChannel === option.value}
                onChange={() => setNotifChannel(option.value)}
                className="mt-0.5 accent-primary outline-none"
              />
              <div>
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveNotifChannel}
            disabled={isSavingNotif}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSavingNotif ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* Alpaca section — AC2, AC3 */}
      <section aria-labelledby="alpaca-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="alpaca-heading" className="text-xl font-medium text-foreground">Alpaca</h2>
          {/* ConnectionStatusDot — AC2 */}
          <div className="flex items-center gap-1.5 text-sm">
            {profile?.alpaca_connected || alpacaSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-positive" aria-hidden="true" />
                <span className="text-positive">Connected</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 inline-block" aria-hidden="true" />
                <span className="text-muted-foreground">Not connected</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* API Key input — CLAUDE.md Rule 16: type="password" with show/hide */}
          <div>
            <label htmlFor="alpaca-key" className="block text-sm font-medium text-foreground mb-1.5">
              API Key ID
            </label>
            <div className="relative">
              <input
                id="alpaca-key"
                type={showAlpacaKey ? 'text' : 'password'}
                value={alpacaKey}
                onChange={(e) => setAlpacaKey(e.target.value)}
                placeholder={alpacaSaved ? '••••••••' : 'Paste your Alpaca API Key ID'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowAlpacaKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showAlpacaKey ? 'Hide API key' : 'Show API key'}
              >
                {showAlpacaKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* API Secret input */}
          <div>
            <label htmlFor="alpaca-secret" className="block text-sm font-medium text-foreground mb-1.5">
              API Secret Key
            </label>
            <div className="relative">
              <input
                id="alpaca-secret"
                type={showAlpacaSecret ? 'text' : 'password'}
                value={alpacaSecret}
                onChange={(e) => setAlpacaSecret(e.target.value)}
                placeholder={alpacaSaved ? '••••••••' : 'Paste your Alpaca Secret Key'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowAlpacaSecret(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showAlpacaSecret ? 'Hide secret key' : 'Show secret key'}
              >
                {showAlpacaSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Mode selector — AC3 */}
          <div>
            <p className="block text-sm font-medium text-foreground mb-2">Trading mode</p>
            <div className="flex gap-3">
              {(['paper', 'live'] as const).map((mode) => (
                <label
                  key={mode}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors',
                    'outline-none focus-within:ring-2 focus-within:ring-ring',
                    alpacaMode === mode
                      ? mode === 'live'
                        ? 'border-warning bg-warning-bg text-warning'
                        : 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name="alpaca_mode"
                    value={mode}
                    checked={alpacaMode === mode}
                    onChange={() => setAlpacaMode(mode)}
                    className="accent-primary outline-none"
                  />
                  <span className="capitalize font-medium">{mode}</span>
                  {mode === 'live' && (
                    <span className="text-[10px] font-mono uppercase tracking-wide text-warning">
                      Real money
                    </span>
                  )}
                </label>
              ))}
            </div>
            {alpacaMode === 'live' && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Live mode executes real trades with real funds. Use with caution.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveAlpaca}
            disabled={isSavingAlpaca}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSavingAlpaca ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* BITKUB section — AC3, AC4, AC6 */}
      <section aria-labelledby="bitkub-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 id="bitkub-heading" className="text-xl font-medium text-foreground">BITKUB</h2>
          {/* ConnectionStatusDot — AC4 */}
          <div className="flex items-center gap-1.5 text-sm">
            {profile?.bitkub_connected || bitkubSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-positive" aria-hidden="true" />
                <span className="text-positive">Connected</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 inline-block" aria-hidden="true" />
                <span className="text-muted-foreground">Not connected</span>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">BITKUB API Key and API Secret for crypto holdings.</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="bitkub-key" className="block text-sm font-medium text-foreground mb-1.5">
              API Key
            </label>
            <div className="relative">
              <input
                id="bitkub-key"
                type={showBitkubKey ? 'text' : 'password'}
                value={bitkubKey}
                onChange={(e) => setBitkubKey(e.target.value)}
                placeholder={bitkubSaved ? '••••••••' : 'Paste your BITKUB API Key'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowBitkubKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showBitkubKey ? 'Hide API key' : 'Show API key'}
              >
                {showBitkubKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="bitkub-secret" className="block text-sm font-medium text-foreground mb-1.5">
              API Secret
            </label>
            <div className="relative">
              <input
                id="bitkub-secret"
                type={showBitkubSecret ? 'text' : 'password'}
                value={bitkubSecret}
                onChange={(e) => setBitkubSecret(e.target.value)}
                placeholder={bitkubSaved ? '••••••••' : 'Paste your BITKUB API Secret'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowBitkubSecret(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showBitkubSecret ? 'Hide API secret' : 'Show API secret'}
              >
                {showBitkubSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveBitkub}
            disabled={isSavingBitkub || (!bitkubKey.trim() && !bitkubSecret.trim())}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSavingBitkub ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* InnovestX — Settrade Equity section — AC6 */}
      <section aria-labelledby="invx-equity-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 id="invx-equity-heading" className="text-xl font-medium text-foreground">InnovestX — Settrade Equity</h2>
          {/* ConnectionStatusDot — AC6 */}
          <div className="flex items-center gap-1.5 text-sm">
            {profile?.innovestx_equity_connected || invxEquitySaved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-positive" aria-hidden="true" />
                <span className="text-positive">Connected</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 inline-block" aria-hidden="true" />
                <span className="text-muted-foreground">Not connected</span>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Settrade Open API — App ID and App Secret for Thai equity holdings.</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="invx-equity-key" className="block text-sm font-medium text-foreground mb-1.5">
              Settrade App ID
            </label>
            <div className="relative">
              <input
                id="invx-equity-key"
                type={showInvxEquityKey ? 'text' : 'password'}
                value={invxEquityKey}
                onChange={(e) => setInvxEquityKey(e.target.value)}
                placeholder={invxEquitySaved ? '••••••••' : 'Paste your Settrade App ID'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowInvxEquityKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showInvxEquityKey ? 'Hide App ID' : 'Show App ID'}
              >
                {showInvxEquityKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="invx-equity-secret" className="block text-sm font-medium text-foreground mb-1.5">
              Settrade App Secret
            </label>
            <div className="relative">
              <input
                id="invx-equity-secret"
                type={showInvxEquitySecret ? 'text' : 'password'}
                value={invxEquitySecret}
                onChange={(e) => setInvxEquitySecret(e.target.value)}
                placeholder={invxEquitySaved ? '••••••••' : 'Paste your Settrade App Secret'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowInvxEquitySecret(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showInvxEquitySecret ? 'Hide App Secret' : 'Show App Secret'}
              >
                {showInvxEquitySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveInvxEquity}
            disabled={isSavingInvxEquity || (!invxEquityKey.trim() && !invxEquitySecret.trim())}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSavingInvxEquity ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* InnovestX — Digital Asset section — AC6 */}
      <section aria-labelledby="invx-digital-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 id="invx-digital-heading" className="text-xl font-medium text-foreground">InnovestX — Digital Asset</h2>
          {/* ConnectionStatusDot — AC6 */}
          <div className="flex items-center gap-1.5 text-sm">
            {profile?.innovestx_digital_connected || invxDigitalSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-positive" aria-hidden="true" />
                <span className="text-positive">Connected</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 inline-block" aria-hidden="true" />
                <span className="text-muted-foreground">Not connected</span>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Digital Asset API credentials for crypto holdings. Contact InnovestX support to obtain these credentials.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="invx-digital-key" className="block text-sm font-medium text-foreground mb-1.5">
              Digital Asset API Key
            </label>
            <div className="relative">
              <input
                id="invx-digital-key"
                type={showInvxDigitalKey ? 'text' : 'password'}
                value={invxDigitalKey}
                onChange={(e) => setInvxDigitalKey(e.target.value)}
                placeholder={invxDigitalSaved ? '••••••••' : 'Paste your Digital Asset API Key'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowInvxDigitalKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showInvxDigitalKey ? 'Hide API key' : 'Show API key'}
              >
                {showInvxDigitalKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="invx-digital-secret" className="block text-sm font-medium text-foreground mb-1.5">
              Digital Asset API Secret
            </label>
            <div className="relative">
              <input
                id="invx-digital-secret"
                type={showInvxDigitalSecret ? 'text' : 'password'}
                value={invxDigitalSecret}
                onChange={(e) => setInvxDigitalSecret(e.target.value)}
                placeholder={invxDigitalSaved ? '••••••••' : 'Paste your Digital Asset API Secret'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowInvxDigitalSecret(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showInvxDigitalSecret ? 'Hide API secret' : 'Show API secret'}
              >
                {showInvxDigitalSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveInvxDigital}
            disabled={isSavingInvxDigital || (!invxDigitalKey.trim() && !invxDigitalSecret.trim())}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSavingInvxDigital ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* Charles Schwab section — AC4 (ConnectionStatusDot + TokenExpiryWarning) */}
      <section aria-labelledby="schwab-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="schwab-heading" className="text-xl font-medium text-foreground">Charles Schwab</h2>
          {/* ConnectionStatusDot — AC4 */}
          <div className="flex items-center gap-1.5 text-sm">
            {schwabConnected && !schwabTokenExpired ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-positive" aria-hidden="true" />
                <span className="text-positive">Connected</span>
              </>
            ) : schwabConnected && schwabTokenExpired ? (
              <>
                <AlertCircle className="h-4 w-4 text-warning" aria-hidden="true" />
                <span className="text-warning">Token expired</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 inline-block" aria-hidden="true" />
                <span className="text-muted-foreground">Not connected</span>
              </>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Connect via OAuth to sync your US stock and ETF holdings. Schwab uses secure token-based authentication — no API key required.
        </p>

        {/* TokenExpiryWarning banner — AC4: shown when schwab_token_expired is true */}
        {schwabTokenExpired && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-bg px-4 py-3 text-warning text-sm mb-4"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Schwab connection expired</p>
              <p className="text-xs text-warning/80 mt-0.5">
                Your Schwab OAuth token has expired. Reconnect below to resume syncing your holdings.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <a
            href="/api/auth/schwab"
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium inline-block',
              'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {schwabConnected ? 'Reconnect with Schwab' : 'Connect with Schwab'}
          </a>
        </div>
      </section>

      {/* Webull section — AC3, AC4, AC6 */}
      <section aria-labelledby="webull-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 id="webull-heading" className="text-xl font-medium text-foreground">Webull</h2>
          {/* ConnectionStatusDot — AC4 */}
          <div className="flex items-center gap-1.5 text-sm">
            {profile?.webull_connected || webullSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-positive" aria-hidden="true" />
                <span className="text-positive">Connected</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 inline-block" aria-hidden="true" />
                <span className="text-muted-foreground">Not connected</span>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          Webull API Key and API Secret for US stock and ETF holdings.
        </p>
        {/* AC3: UI-only advisory — not enforced by backend */}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Webull requires a $500 minimum account value for API access.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="webull-key" className="block text-sm font-medium text-foreground mb-1.5">
              API Key
            </label>
            <div className="relative">
              <input
                id="webull-key"
                type={showWebullKey ? 'text' : 'password'}
                value={webullKey}
                onChange={(e) => setWebullKey(e.target.value)}
                placeholder={webullSaved ? '••••••••' : 'Paste your Webull API Key'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowWebullKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showWebullKey ? 'Hide API key' : 'Show API key'}
              >
                {showWebullKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="webull-secret" className="block text-sm font-medium text-foreground mb-1.5">
              API Secret
            </label>
            <div className="relative">
              <input
                id="webull-secret"
                type={showWebullSecret ? 'text' : 'password'}
                value={webullSecret}
                onChange={(e) => setWebullSecret(e.target.value)}
                placeholder={webullSaved ? '••••••••' : 'Paste your Webull API Secret'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowWebullSecret(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showWebullSecret ? 'Hide API secret' : 'Show API secret'}
              >
                {showWebullSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveWebull}
            disabled={isSavingWebull || (!webullKey.trim() && !webullSecret.trim())}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSavingWebull ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* LLM section — STORY-030: AC3, AC4, AC5, AC6, AC7 */}
      <section aria-labelledby="llm-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 id="llm-heading" className="text-xl font-medium text-foreground">AI Research Hub</h2>
          {/* Connection status dot — AC6 */}
          <div className="flex items-center gap-1.5 text-sm">
            {llmSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-positive" aria-hidden="true" />
                <span className="text-positive">Connected</span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 inline-block" aria-hidden="true" />
                <span className="text-muted-foreground">Not connected</span>
              </>
            )}
          </div>
        </div>

        {/* FreeTierNote — AC3 */}
        <p className="text-sm text-muted-foreground mb-4">
          Bring your own API key from any supported provider.{' '}
          <span className="text-foreground/80">
            Gemini 2.0 Flash (Google AI Studio), Llama 3.3 70B (Groq), and DeepSeek V3 are free.
          </span>
        </p>

        {/* Key validation error — AC7 */}
        {llmValidationError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-negative/30 bg-negative-bg px-4 py-3 text-negative text-sm mb-4"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {llmValidationError}
          </div>
        )}

        <div className="space-y-4">
          {/* ProviderSelector — AC4 */}
          <div>
            <label htmlFor="llm-provider" className="block text-sm font-medium text-foreground mb-1.5">
              Provider
            </label>
            <select
              id="llm-provider"
              value={llmProvider}
              onChange={(e) => {
                const newProvider = e.target.value
                setLlmProvider(newProvider)
                setLlmModel(getDefaultModel(newProvider))
                setLlmValidationError(null)
              }}
              className={cn(
                'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <option value="">Select a provider…</option>
              {LLM_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}{p.free ? ' (Free)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* ModelSelector — AC5 */}
          {llmProvider && (
            <div>
              <label htmlFor="llm-model" className="block text-sm font-medium text-foreground mb-1.5">
                Model
              </label>
              {getModelsForProvider(llmProvider).length > 0 ? (
                <select
                  id="llm-model"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  className={cn(
                    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
                    'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  {getModelsForProvider(llmProvider).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                // OpenRouter: user types the model ID manually
                <input
                  id="llm-model"
                  type="text"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="e.g. openai/gpt-4o"
                  className={cn(
                    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
                    'placeholder:text-muted-foreground',
                    'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                />
              )}
            </div>
          )}

          {/* LLMKeyInput — AC6: type="password" with show/hide, ••••••••after save */}
          <div>
            <label htmlFor="llm-key" className="block text-sm font-medium text-foreground mb-1.5">
              API Key
            </label>
            <div className="relative">
              <input
                id="llm-key"
                type={showLlmKey ? 'text' : 'password'}
                value={llmKey}
                onChange={(e) => {
                  setLlmKey(e.target.value)
                  setLlmValidationError(null)
                }}
                placeholder={llmSaved ? '••••••••' : 'Paste your API key'}
                autoComplete="off"
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
              <button
                type="button"
                onClick={() => setShowLlmKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showLlmKey ? 'Hide API key' : 'Show API key'}
              >
                {showLlmKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your key is encrypted with AES-256-GCM and never exposed in any API response.
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveLLM}
            disabled={isSavingLlm || !llmProvider}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSavingLlm ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {/* Knowledge Base section */}
      <section aria-labelledby="knowledge-base-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <h2 id="knowledge-base-heading" className="text-xl font-medium text-foreground mb-1">Knowledge Base</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Manage your uploaded documents and custom research corpus.
        </p>

        {corpusSize && corpusSize.size_bytes >= 400 * 1024 * 1024 && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-bg px-4 py-3 text-warning text-sm mb-4"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Storage near capacity</p>
              <p className="text-xs text-warning/80 mt-0.5">
                Your knowledge base is near capacity (80%). Consider removing uploaded documents.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>
            {corpusSize ? (corpusSize.size_bytes / (1024 * 1024)).toFixed(1) : 0} MB of 500 MB used
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={corpusSize?.size_bytes ?? 0} aria-valuemax={500 * 1024 * 1024}>
          <div
            className={cn(
              'h-full rounded-full transition-all bg-primary',
              corpusSize && corpusSize.size_bytes >= 500 * 1024 * 1024 && 'bg-negative w-full',
              corpusSize && corpusSize.size_bytes >= 400 * 1024 * 1024 && corpusSize.size_bytes < 500 * 1024 * 1024 && 'bg-warning',
            )}
            style={{ width: `${Math.min(((corpusSize?.size_bytes ?? 0) / (500 * 1024 * 1024)) * 100, 100)}%` }}
          />
        </div>
      </section>

      {/* Silo usage bar */}
      <section aria-labelledby="silo-usage-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <h2 id="silo-usage-heading" className="text-xl font-medium text-foreground mb-1">Silo usage</h2>
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>{profile?.active_silo_count ?? 0} of {profile?.silo_limit ?? 5} silos used</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={profile?.active_silo_count ?? 0} aria-valuemax={5}>
          <div
            className={cn(
              'h-full rounded-full transition-all',
              (profile?.active_silo_count ?? 0) >= 5 ? 'bg-negative w-full' : 'bg-primary',
              (profile?.active_silo_count ?? 0) === 1 && 'w-1/5',
              (profile?.active_silo_count ?? 0) === 2 && 'w-2/5',
              (profile?.active_silo_count ?? 0) === 3 && 'w-3/5',
              (profile?.active_silo_count ?? 0) === 4 && 'w-4/5',
              (profile?.active_silo_count ?? 0) === 0 && 'w-0',
            )}
          />
        </div>
      </section>

      <section aria-labelledby="account-heading" className="rounded-lg border border-border bg-card p-6 mb-6">
        <h2 id="account-heading" className="text-xl font-medium text-foreground mb-1">Account</h2>
        <p className="text-sm text-muted-foreground mb-4">Use this to end the current session on this device.</p>
        <div className="flex justify-end">
          <button
            onClick={handleSignOut}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium',
              'bg-secondary text-foreground hover:bg-secondary/80 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </section>

      {/* Disclaimer — CLAUDE.md Rule 14 */}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        This is not financial advice.
      </p>
    </div>
  )
}
