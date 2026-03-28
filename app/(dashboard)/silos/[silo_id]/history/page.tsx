import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { RebalanceHistoryView } from '@/components/rebalance/RebalanceHistoryView'

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
    title: silo?.name ? `History — ${silo.name} | Rebalancify` : 'Rebalance History | Rebalancify',
  }
}

export default async function RebalanceHistoryPage({ params }: Props) {
  const { silo_id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: silo } = await supabase
    .from('silos')
    .select('id, name, platform_type')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) redirect('/silos')

  return <RebalanceHistoryView siloId={silo_id} siloName={silo.name} />
}
