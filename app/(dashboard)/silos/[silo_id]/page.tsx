import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { SiloDetailView } from '@/components/silo/SiloDetailView'

interface Props {
  params: Promise<{ silo_id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { silo_id } = await params
  const supabase = await createClient()
  const { data: silo } = await supabase
    .from('silos')
    .select('name')
    .eq('id', silo_id)
    .single()
  return {
    title: silo?.name ? `${silo.name} | Rebalancify` : 'Silo | Rebalancify',
  }
}

export default async function SiloDetailPage({ params }: Props) {
  const { silo_id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [siloResult, profileResult] = await Promise.all([
    supabase
      .from('silos')
      .select('id, name, platform_type, base_currency, drift_threshold, last_synced_at')
      .eq('id', silo_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single(),
    supabase
      .from('user_profiles')
      .select('alpaca_mode')
      .eq('id', user.id)
      .single(),
  ])

  if (!siloResult.data) redirect('/silos')

  const silo = {
    ...siloResult.data,
    alpaca_mode: profileResult.data?.alpaca_mode ?? 'paper',
  }

  return <SiloDetailView silo={silo} />
}
