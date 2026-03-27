'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileData {
  id: string
  display_name: string | null
  drift_notif_channel: string
  active_silo_count: number
  silo_limit: number
}

async function fetchProfile(): Promise<ProfileData> {
  const res = await fetch('/api/profile')
  if (!res.ok) throw new Error('Failed to fetch profile')
  return res.json()
}

type NotifChannel = 'app' | 'email' | 'both'

const NOTIF_OPTIONS: { value: NotifChannel; label: string; description: string }[] = [
  { value: 'app', label: 'In-app only', description: 'Show drift alerts in the notification bell.' },
  { value: 'email', label: 'Email only', description: 'Send drift alerts to your account email.' },
  { value: 'both', label: 'Both', description: 'In-app notifications and email alerts.' },
]

export default function SettingsPage() {
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

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setNotifChannel((profile.drift_notif_channel as NotifChannel) ?? 'both')
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

      {/* Disclaimer — CLAUDE.md Rule 14 */}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        This is not financial advice.
      </p>
    </div>
  )
}
