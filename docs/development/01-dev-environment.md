# docs/development/01-dev-environment.md — Development Environment Setup

## AGENT CONTEXT

**What this file is:** Step-by-step setup guide for a new developer environment.
**Derived from:** PRD_v1.3.md Section 5.2, TECH_DOCS_v1.2.md (DOC-05)
**Connected to:** docs/development/04-deployment.md
**Critical rules for agents using this file:**
- `ENCRYPTION_KEY` must be a cryptographically random 32-byte key. Do not use a passphrase.
- Never commit `.env.local` to version control.

---

## ⚠️ Pre-Development Credential Setup (Do This on Day 0)

Some integrations require human account registration that takes days or weeks for approval. Start these immediately — before writing any code — so approval arrives before you need it.

| Credential | Where to Register | Lead Time | Needed For |
|---|---|---|---|
| **Charles Schwab developer app** | https://developer.schwab.com → register an app | **1–4 weeks** (manual review) | STORY-015 (Phase 3) |
| **Vercel domain (for Schwab redirect URI)** | Deploy STORY-004 first to get your production URL | < 1 hour | Must match Schwab app registration |
| **Resend domain verification** | https://resend.com → Domains → Add domain → add DNS records | 24–48 hours (DNS propagation) | STORY-002 (Supabase SMTP) + STORY-020 |
| **InnovestX Digital Asset API** | Contact InnovestX support — not self-service | Unknown — investigate before Phase 3 | STORY-014b (Phase 3) |

**Schwab redirect URI chicken-and-egg:** Schwab requires a redirect URI at registration time. Use your expected production domain (`https://[your-project].vercel.app/api/auth/schwab/callback`) even before it exists. After STORY-004 deploys, confirm the URL matches. If you use a custom domain, register that instead.

**Schwab STORY-015 cannot be tested** without an approved Client ID. If approval has not arrived by the time you reach Phase 3, skip STORY-015/015b and implement STORY-013, STORY-014, STORY-014b, STORY-016 first.

---

## Prerequisites

- Node.js 18.17+ (required by Next.js 15)
- pnpm 8+ (`npm install -g pnpm`)
- Git
- Supabase CLI: `pnpm add -g supabase`
- A Supabase account (free tier)
- A Vercel account (free tier)

---

## Setup Steps

### 1. Clone and install

```bash
git clone https://github.com/[org]/rebalancify.git
cd rebalancify
pnpm install
```

### 2. Create Supabase project

1. Go to https://supabase.com → New project
2. Note your Project URL and anon key from Settings → API
3. Enable pgvector: go to Database → Extensions → enable `vector`
4. Enable pg_cron: go to Database → Extensions → enable `pg_cron`

### 2b. Configure Supabase Auth SMTP (Required — do this immediately after creating the project)

Supabase's free tier caps outbound authentication emails (signup verification, password reset) at **3 per hour**. This will block development testing within your first hour. Fix it now by configuring Resend as the SMTP provider:

1. In Supabase dashboard → **Authentication** → **SMTP Settings** → enable **Custom SMTP**
2. Fill in:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** `[your RESEND_API_KEY]`
   - **Sender email:** `noreply@[your-verified-domain]`
   - **Sender name:** `Rebalancify`
3. Click **Save**

> This requires your Resend account (from Pre-Development setup) and a verified sending domain. If your domain is not yet verified, verify it first: Resend dashboard → Domains → Add domain → add the DNS records shown → wait for propagation (24–48 hours).

---

### 3. Run migrations

```bash
supabase login
supabase link --project-ref [your-project-ref]
supabase db push
```

Or manually run each file in `supabase/migrations/` in numbered order via the Supabase SQL editor.

### 4. Configure environment variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]

# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=[32-byte-random-hex]

# External APIs (add as you build each integration)
FINNHUB_API_KEY=[your-key]
FMP_API_KEY=[your-key]
RESEND_API_KEY=[your-key]
EXCHANGERATE_API_KEY=[your-key]

# Schwab OAuth (register your app at developer.schwab.com)
SCHWAB_CLIENT_ID=[your-app-client-id]
SCHWAB_CLIENT_SECRET=[your-app-client-secret]
SCHWAB_REDIRECT_URI=https://[your-domain]/api/auth/schwab/callback
```

### 5. Initialise shadcn/ui

```bash
npx shadcn-ui@latest init
```

When prompted, use the configuration specified in `docs/design/05-theme-implementation.md` under `components.json`. Key answers:
- Style: **New York**
- Base color: **Neutral**
- CSS variables: **Yes**

This generates `components.json` and configures import aliases. Do not run `shadcn-ui init` again after this — it will overwrite `components.json`.

### 6. Start development server

```bash
pnpm dev
```

Open http://localhost:3000. Create an account — the auth trigger will auto-create your `user_profiles` row.

---

### 7. Verify the test setup works

Before writing any code, confirm the test runner is installed correctly:

```bash
# Should exit 0 — even with zero test files, the runner should start cleanly
pnpm test

# Should exit 0 with zero TypeScript errors
pnpm type-check

# Should compile successfully
pnpm build
```

If `pnpm test` fails with "vitest: command not found", run `pnpm add -D vitest @vitejs/plugin-react jsdom` and re-run.

The full test configuration (vitest.config.ts, test-utils/) is set up in STORY-002. If you are setting up from scratch before STORY-002 is complete, these scripts may not exist yet — that is expected.

---

## Environment Variables Reference

| Variable | Required | Where Used |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side operations (auth trigger, admin) |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM key encryption/decryption |
| `FINNHUB_API_KEY` | Phase 1+ | Price fetching, news, peer data |
| `FMP_API_KEY` | Phase 5+ | News fallback |
| `RESEND_API_KEY` | Phase 4+ | Drift digest email |
| `EXCHANGERATE_API_KEY` | Phase 4+ | FX rates |
| `SCHWAB_CLIENT_ID` | Phase 3+ | Schwab OAuth app client ID — from developer.schwab.com |
| `SCHWAB_CLIENT_SECRET` | Phase 3+ | Schwab OAuth app client secret — from developer.schwab.com |
| `SCHWAB_REDIRECT_URI` | Phase 3+ | Schwab OAuth callback URL — must match your registered redirect URI |
| `EMBEDDING_PROVIDER` | Phase 8+ | Embedding provider for RAG ingest: `google` (default, free) or `openai` (paid) |
| `EMBEDDING_API_KEY` | Phase 8+ | API key for the embedding provider — separate from the user's LLM key |
| `CRON_SECRET` | Phase 4+ | Random secret to authenticate Vercel Cron Job requests — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
