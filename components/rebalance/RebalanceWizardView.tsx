/**
 * RebalanceWizardView — Client orchestrator for the 3-step rebalancing wizard.
 *
 * Manages wizard step state and renders the correct panel per step.
 * Displays StepIndicator and AlpacaLiveBadge (CLAUDE.md Rule 15).
 *
 * AC1: StepIndicator with 3 named steps
 * CLAUDE.md Rule 15: AlpacaLiveBadge always visible when alpaca_mode='live'
 * CLAUDE.md Rule 14: "This is not financial advice" footer
 */
'use client'

import { useState } from 'react'
import { AlpacaLiveBadge } from '@/components/shared/AlpacaLiveBadge'
import { RebalanceConfigPanel } from '@/components/rebalance/RebalanceConfigPanel'
import { OrderReviewPanel } from '@/components/rebalance/OrderReviewPanel'
import { ExecutionResultPanel } from '@/components/rebalance/ExecutionResultPanel'
import type { CalculateResponse, ExecuteResponse } from '@/lib/types/rebalance'

interface SiloData {
  id: string
  name: string
  platform_type: string
  base_currency: 'USD' | 'THB'
  alpaca_mode: string
}

interface Props {
  silo: SiloData
  initialWeightsSum: number
}

type Step = 1 | 2 | 3

const STEPS: { label: string; shortLabel: string }[] = [
  { label: 'Config', shortLabel: '① Config' },
  { label: 'Review', shortLabel: '② Review' },
  { label: 'Result', shortLabel: '③ Result' },
]

function StepIndicator({ currentStep }: { currentStep: Step }) {
  return (
    <nav aria-label="Wizard steps" className="flex items-center gap-1 text-sm">
      {STEPS.map((step, i) => {
        const stepNum = (i + 1) as Step
        const isActive = stepNum === currentStep
        const isComplete = stepNum < currentStep

        return (
          <div key={step.label} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-muted-foreground/40 mx-1" aria-hidden="true">→</span>
            )}
            <span
              aria-current={isActive ? 'step' : undefined}
              className={`font-mono text-xs px-2 py-1 rounded ${
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : isComplete
                  ? 'text-positive'
                  : 'text-muted-foreground'
              }`}
            >
              {stepNum === 1 ? '①' : stepNum === 2 ? '②' : '③'} {step.label}
            </span>
          </div>
        )
      })}
    </nav>
  )
}

export function RebalanceWizardView({ silo, initialWeightsSum }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [calculateResult, setCalculateResult] = useState<CalculateResponse | null>(null)
  const [executeResult, setExecuteResult] = useState<ExecuteResponse | null>(null)

  const isAlpacaLive = silo.platform_type === 'alpaca' && silo.alpaca_mode === 'live'

  function handleCalculated(result: CalculateResponse) {
    setCalculateResult(result)
    setStep(2)
  }

  function handleExecuted(result: ExecuteResponse) {
    setExecuteResult(result)
    setStep(3)
  }

  function handleBack() {
    setStep(1)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header: silo name + AlpacaLiveBadge (CLAUDE.md Rule 15) */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-foreground">{silo.name}</h1>
        {isAlpacaLive && <AlpacaLiveBadge />}
      </div>

      {/* Step indicator (AC1) */}
      <StepIndicator currentStep={step} />

      <div className="bg-card border border-border rounded-lg p-6">
        {step === 1 && (
          <RebalanceConfigPanel
            siloId={silo.id}
            initialWeightsSum={initialWeightsSum}
            onCalculated={handleCalculated}
          />
        )}

        {step === 2 && calculateResult && (
          <OrderReviewPanel
            siloId={silo.id}
            siloName={silo.name}
            platformType={silo.platform_type}
            baseCurrency={silo.base_currency}
            calculateResult={calculateResult}
            onExecuted={handleExecuted}
            onBack={handleBack}
          />
        )}

        {step === 3 && calculateResult && executeResult && (
          <ExecutionResultPanel
            siloId={silo.id}
            platformType={silo.platform_type}
            baseCurrency={silo.base_currency}
            calculateResult={calculateResult}
            executeResult={executeResult}
          />
        )}
      </div>

      {/* Disclaimer — CLAUDE.md Rule 14 */}
      <footer className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
        This is not financial advice.
      </footer>
    </div>
  )
}
