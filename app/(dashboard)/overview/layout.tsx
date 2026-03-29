import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Metadata cannot be exported from 'use client' components (Next.js constraint).
// This server layout provides the title for the Overview page.
export const metadata: Metadata = {
  title: 'Overview | Rebalancify',
}

export default function OverviewLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
