import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Metadata cannot be exported from 'use client' components (Next.js constraint).
// This server layout provides the title for the Discover page.
export const metadata: Metadata = {
  title: 'Discover | Rebalancify',
}

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
