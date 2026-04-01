# Sub-Component: Rebalance Wizard View

## 1. The Goal

Orchestrate the full 3-step rebalancing wizard as a single client component — managing step state, rendering the correct panel per step, and displaying the `AlpacaLiveBadge` when the silo is connected to Alpaca in live trading mode.

---

## 2. The Problem It Solves

The wizard has three distinct steps with different UI panels. Without a single orchestrator, each step would need to independently manage its own state and navigation. The orchestrator ensures transitions between steps are clean, the current step is always visible in the `StepIndicator`, and the amber `LIVE` badge is always shown for live Alpaca silos.

---

## 3. The Proposed Solution / Underlying Concept

### Step State

```typescript
type Step = 1 | 2 | 3

const [step, setStep] = useState<Step>(1)
const [calculateResult, setCalculateResult] = useState<CalculateResponse | null>(null)
const [executeResult, setExecuteResult] = useState<ExecuteResponse | null>(null)
```

### StepIndicator

Three named steps shown as a horizontal breadcrumb:

```
① Config → ② Review → ③ Result
```

- Current step: `bg-primary text-primary-foreground`
- Completed step: `text-positive`
- Future step: `text-muted-foreground`

```typescript
<nav aria-label="Wizard steps">
  {STEPS.map((step, i) => (
    <span aria-current={isActive ? 'step' : undefined}>
      {stepNum === 1 ? '①' : stepNum === 2 ? '②' : '③'} {step.label}
    </span>
  ))}
</nav>
```

### Wizard Panels

| Step | Panel Rendered |
|---|---|
| 1 | `<RebalanceConfigPanel onCalculated={handleCalculated} />` |
| 2 | `<OrderReviewPanel calculateResult={calculateResult} onExecuted={handleExecuted} onBack={handleBack} />` |
| 3 | `<ExecutionResultPanel calculateResult={calculateResult} executeResult={executeResult} />` |

### AlpacaLiveBadge Rule (CLAUDE.md Rule 15)

```typescript
const isAlpacaLive = silo.platform_type === 'alpaca' && silo.alpaca_mode === 'live'
// ...
{isAlpacaLive && <AlpacaLiveBadge />}
```

The badge is always rendered — never conditionally hidden based on user preference.

### Props

```typescript
interface Props {
  silo: SiloData          // { id, name, platform_type, base_currency, alpaca_mode }
  initialWeightsSum: number  // passed to ConfigPanel for WeightsSumWarning
}
```

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Step 1 → Step 2 transition | Click "Calculate orders" → Review panel renders |
| Step 2 → Step 3 transition | Execute → Result panel renders |
| AlpacaLiveBadge on live silo | Open wizard for Alpaca live silo → amber badge visible |
| No badge on paper Alpaca | Open wizard for Alpaca paper silo → no badge |
| Step indicator shows current step | On Step 2 → "② Review" has primary background |
| `pnpm build` | Compiles without errors |
