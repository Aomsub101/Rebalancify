/**
 * lib/driftDigest.ts
 * Pure helpers for the daily drift digest email.
 * DB queries and Resend API calls live in app/api/cron/drift-digest/route.ts.
 */

/** A single asset that has breached its drift threshold. */
export interface DriftBreachItem {
  siloName: string
  ticker: string
  currentDriftPct: number
  threshold: number
  currentWeightPct: number
  targetWeightPct: number
}

/**
 * Escapes HTML special characters to prevent XSS in generated email HTML.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Builds the HTML body for the drift digest email.
 * Always includes the "This is not financial advice" disclaimer (CLAUDE.md Rule 14).
 *
 * @param items - Breached assets to include in the digest (may be empty)
 * @returns Full HTML string suitable for Resend's `html` field
 */
export function buildDriftDigestHtml(items: DriftBreachItem[]): string {
  const rows =
    items.length === 0
      ? '<p style="color:#6b7280;">No drift breaches to report today.</p>'
      : items
          .map(
            (item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.siloName)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;">${escapeHtml(item.ticker)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.currentDriftPct.toFixed(1)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.threshold.toFixed(1)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.currentWeightPct.toFixed(1)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.targetWeightPct.toFixed(1)}%</td>
    </tr>`,
          )
          .join('')

  const tableBody =
    items.length === 0
      ? rows
      : `
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:8px 12px;text-align:left;font-weight:600;">Silo</th>
        <th style="padding:8px 12px;text-align:left;font-weight:600;">Ticker</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;">Drift</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;">Threshold</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;">Current %</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;">Target %</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Rebalancify — Daily Drift Digest</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Rebalancify</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">Daily Drift Digest</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 24px;font-size:15px;color:#374151;">
        The following assets in your portfolio have drifted beyond their configured thresholds:
      </p>

      ${tableBody}

      <p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
        Log in to <a href="https://rebalancify.app" style="color:#3b82f6;text-decoration:none;">Rebalancify</a>
        to review your portfolio and run a rebalance if needed.
      </p>
    </div>

    <!-- Footer / Disclaimer -->
    <div style="background:#f3f4f6;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
        <strong>This is not financial advice.</strong>
        Rebalancify is a decision-support tool only. All investment decisions are yours alone.
        You are receiving this email because you enabled drift email alerts in your account settings.
      </p>
    </div>

  </div>
</body>
</html>`
}
