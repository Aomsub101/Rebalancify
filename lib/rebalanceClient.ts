'use client'

import type { CalculateResponse, ExecuteResponse } from '@/lib/types/rebalance'

export async function calculateRebalanceOrders(params: {
  siloId: string
  mode: 'partial' | 'full'
}): Promise<CalculateResponse> {
  const response = await fetch(`/api/silos/${params.siloId}/rebalance/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: params.mode }),
  })
  const data = await response.json()

  if (!response.ok && response.status !== 422) {
    throw new Error(data?.error?.message ?? 'Calculation failed')
  }

  return data as CalculateResponse
}

export async function executeRebalanceOrders(params: {
  siloId: string
  sessionId: string
  approvedOrderIds: string[]
  skippedOrderIds: string[]
}): Promise<ExecuteResponse> {
  const response = await fetch(`/api/silos/${params.siloId}/rebalance/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: params.sessionId,
      approved_order_ids: params.approvedOrderIds,
      skipped_order_ids: params.skippedOrderIds,
    }),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Execution failed')
  }

  return data as ExecuteResponse
}
