/**
 * OnboardingGate — decides when to show the OnboardingModal and ProgressBanner.
 *
 * STORY-028 AC-1, AC-4, AC-6, AC-7, AC-8
 * Mounted once in (dashboard)/layout.tsx, above all page content.
 * Reads SessionContext (onboarded, siloCount, progressBannerDismissed) to decide
 * which — if any — overlay to render.
 */
'use client'

import { useSession } from '@/contexts/SessionContext'
import { OnboardingModal } from '@/components/shared/OnboardingModal'
import { ProgressBanner } from '@/components/shared/ProgressBanner'

export function OnboardingGate() {
  const { onboarded, siloCount, progressBannerDismissed, isLoading } = useSession()

  // Don't render anything while auth is still resolving
  if (isLoading) return null

  // AC-1: modal appears when not onboarded AND no silos yet
  const showModal = !onboarded && siloCount === 0

  // AC-7: banner appears when onboarded, has a silo, and not dismissed
  const showBanner = onboarded && siloCount > 0 && !progressBannerDismissed

  return (
    <>
      {/* AC-10: modal — non-dismissible */}
      <OnboardingModal open={showModal} />

      {/* AC-7/8/9: progress banner */}
      {showBanner && <ProgressBanner />}
    </>
  )
}
