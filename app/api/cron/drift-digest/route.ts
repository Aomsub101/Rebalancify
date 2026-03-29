/**
 * GET /api/cron/drift-digest
 *
 * Vercel Cron Job — runs daily at 08:00 UTC (scheduled in vercel.json).
 * Handles two tasks:
 *   1. Drift digest emails — for users with drift_notif_channel IN ('email', 'both')
 *      whose assets have breached their drift threshold.
 *   2. Schwab token expiry notifications — inserts an in-app notification when a
 *      Schwab refresh token expires within 2 days (per STORY-020 Notes).
 *
 * Authentication: requires `Authorization: Bearer $CRON_SECRET` header.
 * Resend failures are logged and skipped — in-app notifications (via pg_cron) still fire.
 *
 * AC-3: Email delivery via Resend for drift breaches
 * AC-4: Graceful Resend failure — log only, no crash
 * AC-6: Email includes "This is not financial advice" disclaimer
 * Note: Schwab token expiry check added per STORY-020 Notes section
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildDriftDigestHtml, type DriftBreachItem } from '@/lib/driftDigest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SiloRow {
  id: string
  name: string
  drift_threshold: number
  user_id: string
}

interface HoldingWithPrice {
  asset_id: string
  quantity: string
  ticker: string
  price: string
  target_weight_pct: number
}

interface UserProfileRow {
  id: string
  drift_notif_channel: string
  schwab_token_expires: string | null
}

interface DigestUser {
  userId: string
  email: string
  channel: string
  schwabTokenExpires: string | null
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // --- Auth: validate CRON_SECRET header ---
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing CRON_SECRET' } },
      { status: 401 },
    )
  }

  // --- Service-role Supabase client (bypasses RLS — cron has no user context) ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[cron/drift-digest] Missing Supabase environment variables')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // --- Resend client ---
  const resendApiKey = process.env.RESEND_API_KEY
  const resend = resendApiKey ? new Resend(resendApiKey) : null

  const emailsSent: string[] = []
  const emailsFailed: string[] = []
  const schwabNotifInserted: string[] = []

  // -------------------------------------------------------------------------
  // 1. Fetch users who want email or both notifications
  // -------------------------------------------------------------------------
  const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers()
  if (authUsersError || !authUsers) {
    console.error('[cron/drift-digest] Failed to list auth users:', authUsersError)
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
  }

  // Build a map of userId → email
  const emailByUserId = new Map<string, string>(
    authUsers.users.map((u) => [u.id, u.email ?? '']),
  )

  // Fetch profiles of users who want email notifications
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('id, drift_notif_channel, schwab_token_expires')

  if (profilesError || !profiles) {
    console.error('[cron/drift-digest] Failed to fetch profiles:', profilesError)
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }

  const digestUsers: DigestUser[] = profiles
    .filter(
      (p: UserProfileRow) =>
        p.drift_notif_channel === 'email' || p.drift_notif_channel === 'both',
    )
    .map((p: UserProfileRow) => ({
      userId: p.id,
      email: emailByUserId.get(p.id) ?? '',
      channel: p.drift_notif_channel,
      schwabTokenExpires: p.schwab_token_expires,
    }))
    .filter((u) => u.email.length > 0)

  // -------------------------------------------------------------------------
  // 2. Schwab token expiry notifications (all users, not just email-channel)
  //    Insert in-app notification if schwab_token_expires < NOW() + 2 days
  // -------------------------------------------------------------------------
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()

  const schwabExpiringProfiles = profiles.filter(
    (p: UserProfileRow) =>
      p.schwab_token_expires !== null && p.schwab_token_expires < twoDaysFromNow,
  )

  for (const profile of schwabExpiringProfiles) {
    // Only insert if no unread schwab_token_expiring notification exists already today
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', profile.id)
      .eq('type', 'schwab_token_expiring')
      .eq('is_read', false)
      .gte('created_at', new Date().toISOString().split('T')[0])
      .limit(1)

    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'schwab_token_expiring',
        message:
          'Your Charles Schwab connection expires soon. Please reconnect in Settings to maintain portfolio sync.',
      })

      if (insertError) {
        console.error(
          `[cron/drift-digest] Failed to insert schwab_token_expiring notification for ${profile.id}:`,
          insertError,
        )
      } else {
        schwabNotifInserted.push(profile.id)
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Drift breach email per user
  // -------------------------------------------------------------------------
  for (const user of digestUsers) {
    // Fetch all active silos for this user
    const { data: silos, error: silosError } = await supabase
      .from('silos')
      .select('id, name, drift_threshold')
      .eq('user_id', user.userId)
      .eq('is_active', true)

    if (silosError || !silos || silos.length === 0) continue

    const breachedItems: DriftBreachItem[] = []

    for (const silo of silos as SiloRow[]) {
      // Compute total silo value from holdings + price_cache
      const { data: holdings, error: holdingsError } = await supabase
        .from('holdings')
        .select(`
          asset_id,
          quantity,
          assets!inner(ticker),
          price_cache!inner(price),
          target_weights(weight_pct)
        `)
        .eq('silo_id', silo.id)

      if (holdingsError || !holdings || holdings.length === 0) continue

      // Flatten the nested joins
      const rows: HoldingWithPrice[] = (holdings as unknown as Array<{
        asset_id: string
        quantity: string
        assets: { ticker: string }
        price_cache: { price: string }
        target_weights: Array<{ weight_pct: string }> | null
      }>).map((h) => ({
        asset_id: h.asset_id,
        quantity: h.quantity,
        ticker: h.assets.ticker,
        price: h.price_cache.price,
        target_weight_pct: h.target_weights?.[0]
          ? parseFloat(h.target_weights[0].weight_pct)
          : 0,
      }))

      // Calculate total value
      const totalValue = rows.reduce(
        (sum, r) => sum + parseFloat(r.quantity) * parseFloat(r.price),
        0,
      )

      if (totalValue === 0) continue

      // Find breached assets
      for (const row of rows) {
        const positionValue = parseFloat(row.quantity) * parseFloat(row.price)
        const currentWeightPct = (positionValue / totalValue) * 100
        const drift = Math.abs(currentWeightPct - row.target_weight_pct)

        if (drift > silo.drift_threshold) {
          breachedItems.push({
            siloName: silo.name,
            ticker: row.ticker,
            currentDriftPct: parseFloat(drift.toFixed(1)),
            threshold: silo.drift_threshold,
            currentWeightPct: parseFloat(currentWeightPct.toFixed(1)),
            targetWeightPct: row.target_weight_pct,
          })
        }
      }
    }

    if (breachedItems.length === 0) continue

    // Send email via Resend (AC-3)
    if (!resend || !resendApiKey) {
      console.warn(
        `[cron/drift-digest] RESEND_API_KEY not configured — skipping email for ${user.userId}`,
      )
      emailsFailed.push(user.userId)
      continue
    }

    try {
      const html = buildDriftDigestHtml(breachedItems)
      const { error: sendError } = await resend.emails.send({
        from: 'Rebalancify <onboarding@resend.dev>',
        // Note: using a fixed email for testing to avoid sending real emails during development
        to: 'testingreceiving012@gmail.com',
        subject: `Drift Alert: ${breachedItems.length} asset${breachedItems.length > 1 ? 's' : ''} need attention`,
        html,
      })

      if (sendError) {
        // AC-4: Resend failure — log only, do not crash
        console.error(
          `[cron/drift-digest] Resend error for user ${user.userId}:`,
          sendError,
        )
        emailsFailed.push(user.userId)
      } else {
        emailsSent.push(user.userId)
      }
    } catch (err) {
      // AC-4: Unexpected failure — log only, continue processing remaining users
      console.error(
        `[cron/drift-digest] Unexpected Resend error for user ${user.userId}:`,
        err,
      )
      emailsFailed.push(user.userId)
    }
  }

  return NextResponse.json({
    ok: true,
    emailsSent: emailsSent.length,
    emailsFailed: emailsFailed.length,
    schwabNotificationsInserted: schwabNotifInserted.length,
  })
}
