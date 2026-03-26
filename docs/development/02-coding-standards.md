# docs/development/02-coding-standards.md — Coding Standards

## AGENT CONTEXT

**What this file is:** The authoritative coding standards for all TypeScript, React, and API route code. Every rule here is enforced — deviations are bugs, not style disagreements.
**Derived from:** CLAUDE.md (all 20 rules), design_preferences.md Section 9
**Connected to:** CLAUDE.md (source of truth for rules), docs/design/CLAUDE_FRONTEND.md (frontend-specific rules)
**Critical rules for agents using this file:**
- These rules don't have exceptions. If a rule seems to conflict with something, the rule wins.
- "All monetary values as NUMERIC(20,8)" applies to JavaScript too: use string arithmetic, not floats.

---

## TypeScript

- `strict: true` in `tsconfig.json`. No `any` types.
- Use `interface` for object shapes that describe data from the API or DB. Use `type` for unions and computed types.
- All API response shapes have a TypeScript interface in `types/api.ts`.
- All DB table row shapes have a TypeScript interface in `types/database.ts`.
- Export types from `types/index.ts` — no direct imports from internal type files in components.

---

## Financial Data Arithmetic

| Rule | Why |
|---|---|
| Store as `NUMERIC(20,8)` in PostgreSQL | Avoids float rounding errors in storage |
| Receive from API as `string` | JSON number precision is limited |
| Never use `parseFloat()` or `Number()` for monetary arithmetic | Both introduce floating-point errors |
| Use string comparison for sorting | `"0.10000000" > "0.09000000"` works correctly for 8dp strings |
| For display: call `formatNumber()` — never inline `toFixed()` | Centralises formatting logic |
| For summation in SQL: use `SUM(NUMERIC)` — never aggregate in JavaScript | PostgreSQL arithmetic on NUMERIC is exact |

---

## React Component Rules

1. **All interactive components are client components.** Add `"use client"` directive at the top.
2. **No `<form>` tags.** Controlled inputs + `onClick` handlers only.
3. **No inline `style={{}}`**. All styling via Tailwind classes.
4. **All external API calls go through `/api/` routes** — never call external services directly from components.
5. **Every data-fetching component must handle three states:** loading (skeleton), error (ErrorBanner), empty (EmptyState).
6. **`useQuery` for all data fetching.** No `useEffect(() => { fetch(...) }, [])`.
7. **`useMutation` for all writes.** Must call `queryClient.invalidateQueries()` on success.
8. **`ConfirmDialog` is non-dismissible.** No `onOpenChange` prop.
9. **One primary button per page section.**

---

## API Route Rules (app/api/)

1. Every route must validate the Supabase JWT: `const { data: { user } } = await supabase.auth.getUser()`. If `!user`, return 401.
2. Every route that touches a user's data must pass `user.id` as a filter — never query all rows.
3. API keys received in request bodies are encrypted immediately, before any other processing.
4. Decrypted API keys are never logged, never returned in responses, never stored in variables that outlive the request.
5. All monetary values returned in API responses are strings with 8 decimal places.
6. Standard error response shape: `{ error: { code, message, detail? } }` — see `docs/architecture/03-api-contract.md`.
7. Route files are named `route.ts` and export named HTTP method handlers: `export async function GET()`, `export async function POST()`, etc.

---

## Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| React components | PascalCase | `SiloCard`, `DriftBadge` |
| Hooks | camelCase with `use` prefix | `useHoldings`, `useProfile` |
| Utility functions | camelCase | `formatNumber`, `encryptKey` |
| Constants | SCREAMING_SNAKE_CASE | `SILO_LIMIT`, `CACHE_TTL_MS` |
| CSS custom properties | kebab-case | `--primary`, `--sidebar-foreground` |
| API route query params | snake_case | `?asset_type=stock` |
| Database columns | snake_case | `created_at`, `silo_id` |
| TypeScript interfaces | PascalCase | `SiloRow`, `HoldingWithDrift` |
| File names | kebab-case | `silo-card.tsx`, `format-number.ts` |

---

## File Length Limits

| File type | Soft limit | Hard limit |
|---|---|---|
| React component | 150 lines | 300 lines |
| API route handler | 100 lines | 200 lines |
| Utility function file | 200 lines | 400 lines |

If a file exceeds the soft limit, consider splitting. If it exceeds the hard limit, it must be split.

---

## Import Order

```typescript
// 1. React
import { useState, useEffect } from 'react'
// 2. Next.js
import { useRouter } from 'next/navigation'
// 3. Third-party libraries
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
// 4. Internal — absolute imports
import { SessionContext } from '@/contexts/SessionContext'
import { formatNumber } from '@/lib/formatNumber'
// 5. Internal — relative imports
import { DriftBadge } from './DriftBadge'
// 6. Types
import type { HoldingWithDrift } from '@/types'
```

---

## Page Metadata (Document Title)

Every page must export a `metadata` object or `generateMetadata` function.
This sets the browser tab title, which matters for users who have multiple
Rebalancify tabs open simultaneously.

**Static metadata (most pages):**

```typescript
// app/(dashboard)/overview/page.tsx
export const metadata = { title: 'Overview | Rebalancify' }

// app/(dashboard)/news/page.tsx
export const metadata = { title: 'News | Rebalancify' }

// app/(dashboard)/discover/page.tsx
export const metadata = { title: 'Discover | Rebalancify' }

// app/(dashboard)/settings/page.tsx
export const metadata = { title: 'Settings | Rebalancify' }
```

**Dynamic metadata (silo-specific pages):**

```typescript
// app/(dashboard)/silos/[silo_id]/page.tsx
export async function generateMetadata({ params }: { params: { silo_id: string } }) {
  // Fetch silo name from Supabase server client
  const silo = await getSiloName(params.silo_id)
  return { title: silo ? `${silo.name} | Rebalancify` : 'Silo | Rebalancify' }
}

// app/(dashboard)/silos/[silo_id]/rebalance/page.tsx
export async function generateMetadata({ params }: { params: { silo_id: string } }) {
  const silo = await getSiloName(params.silo_id)
  return { title: silo ? `Rebalance — ${silo.name} | Rebalancify` : 'Rebalance | Rebalancify' }
}
```

**Root layout metadata (fallback):**

```typescript
// app/layout.tsx
export const metadata = {
  title: { default: 'Rebalancify', template: '%s | Rebalancify' },
  description: 'Portfolio clarity for every platform.',
}
```

**Format rule:** `[Page/Entity Name] | Rebalancify`. Never just "Rebalancify" for leaf pages.
