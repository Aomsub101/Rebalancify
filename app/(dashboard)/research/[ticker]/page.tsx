import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ResearchHubClient } from '@/components/research/ResearchHubClient'
import { DisclaimerBanner } from '@/components/research/DisclaimerBanner'

interface Props {
  params: Promise<{ ticker: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params
  return {
    title: `${ticker.toUpperCase()} Research | Rebalancify`,
  }
}

export default async function ResearchTickerPage({ params }: Props) {
  const { ticker } = await params
  const upperTicker = ticker.toUpperCase()

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [assetResult, profileResult] = await Promise.all([
    supabase.from('assets').select('name').eq('ticker', upperTicker).limit(1).single(),
    supabase.from('user_profiles').select('llm_key_enc').eq('id', user.id).single(),
  ])

  const companyName = assetResult.data?.name ?? upperTicker
  const llmConnected = profileResult.data?.llm_key_enc != null

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-6 space-y-4">
        <DisclaimerBanner />
        <ResearchHubClient
          ticker={upperTicker}
          companyName={companyName}
          llmConnected={llmConnected}
        />
      </div>

      <footer className="mt-auto pt-6">
        <p className="text-xs text-muted-foreground text-center">
          This is not financial advice.
        </p>
      </footer>
    </div>
  )
}

