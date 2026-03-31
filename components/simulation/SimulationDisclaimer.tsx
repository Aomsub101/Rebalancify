/**
 * SimulationDisclaimer — non-collapsible amber disclaimer banner.
 * Always visible when simulation results are shown.
 * F11-R12: "This is not financial advice" disclaimer must always be visible.
 */
export function SimulationDisclaimer() {
  return (
    <div
      role="note"
      className="w-full rounded-md border bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
    >
      Simulation results are based on historical data and do not guarantee future performance. This tool is
      for educational purposes and does not constitute financial advice.
    </div>
  )
}
