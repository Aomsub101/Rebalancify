import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Metadata cannot be exported from 'use client' components (Next.js constraint).
// This server layout provides the title for the News page.
export const metadata: Metadata = {
  title: 'News | Rebalancify',
}

export default function NewsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
