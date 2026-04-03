'use client'

import type { QueryClient } from '@tanstack/react-query'

export const PROFILE_QUERY_KEY = ['profile'] as const

export async function fetchProfile<T>(
  init?: RequestInit,
): Promise<T> {
  const response = await fetch('/api/profile', init)
  if (!response.ok) {
    throw new Error('Failed to fetch profile')
  }

  return response.json() as Promise<T>
}

export async function tryFetchProfile<T>(
  init?: RequestInit,
): Promise<T | null> {
  const response = await fetch('/api/profile', init)
  if (!response.ok) {
    return null
  }

  return response.json() as Promise<T>
}

export async function patchProfile<T>(
  fields: Record<string, unknown>,
): Promise<T> {
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Update failed')
  }

  return data as T
}

export function invalidateProfileQuery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
}
