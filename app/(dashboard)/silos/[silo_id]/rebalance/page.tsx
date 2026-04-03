import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { RebalanceWizardView } from '@/components/rebalance/RebalanceWizardView'

interface Props {
  params: Promise<{ silo_id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { silo_id } = await params
  const cookieStore = await cookies()
  const bypassCookie = cookieStore.get('E2E_BYPASS')
  if (process.env.PLAYWRIGHT_TEST_BYPASS === '1' || bypassCookie?.value === '1') {
    return {
      title: 'Rebalance | Rebalancify',
    }
  }

  const supabase = await createClient()
  const { data: silo } = await supabase
    .from('silos')
    .select('name')
    .eq('id', silo_id)
    .single()
  return {
    title: silo?.name ? `Rebalance — ${silo.name} | Rebalancify` : 'Rebalance | Rebalancify',
  }
}

export default async function RebalancePage({ params }: Props) {
  const { silo_id } = await params
  const cookieStore = await cookies()
  const bypassCookie = cookieStore.get('E2E_BYPASS')

  // Playwright E2E bypass: skip Supabase auth and return mock silo data.
  // Supports both the server env flag and the middleware bypass cookie so
  // the page can render reliably in CI and local Playwright runs.
  if (process.env.PLAYWRIGHT_TEST_BYPASS === '1' || bypassCookie?.value === '1') {
    const mockSilo = {
      id: silo_id,
      name: 'Test Silo (Alpaca)',
      platform_type: 'alpaca',
      base_currency: 'USD' as const,
      alpaca_mode: 'paper',
    }
    return <RebalanceWizardView silo={mockSilo} initialWeightsSum={100} />
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [siloResult, profileResult, weightsResult] = await Promise.all([
    supabase
      .from('silos')
      .select('id, name, platform_type, base_currency')
      .eq('id', silo_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single(),
    supabase
      .from('user_profiles')
      .select('alpaca_mode')
      .eq('id', user.id)
      .single(),
    supabase
      .from('target_weights')
      .select('weight_pct')
      .eq('silo_id', silo_id),
  ])

  if (!siloResult.data) redirect('/silos')

  const weightsSum = (weightsResult.data ?? []).reduce(
    (sum, w) => sum + parseFloat(String(w.weight_pct)),
    0,
  )

  const silo = {
    ...siloResult.data,
    alpaca_mode: profileResult.data?.alpaca_mode ?? 'paper',
  }

  return <RebalanceWizardView silo={silo} initialWeightsSum={weightsSum} />
}
