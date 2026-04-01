# Sub-Component: API — Knowledge Corpus Size

## 1. The Goal

Report the current storage size of the user's knowledge chunks to the Settings page, enabling a capacity warning when the corpus approaches the 500 MB limit (80% = 400 MB threshold).

---

## 2. The Problem It Solves

The default knowledge base + user uploads share a 500 MB budget per user. Without a size monitoring endpoint, the system would silently fail when storage is exhausted, or users would never know they are approaching capacity until uploads start failing.

---

## 3. The Proposed Solution / Underlying Concept

### Endpoint: `GET /api/knowledge/corpus-size`

**Response:**
```typescript
{
  bytes_used: number,       // total bytes consumed by user's knowledge_chunks
  bytes_limit: number,       // 500_000_000 (500 MB)
  percent_used: number,      // e.g., 65.4
  is_near_capacity: boolean  // true if percent_used >= 80
}
```

### Computation

Uses `pg_total_relation_size('knowledge_chunks')` filtered to the user's chunks, divided by the 500 MB limit.

### Settings Warning Display

Settings page calls `GET /api/knowledge/corpus-size` on load. If `is_near_capacity === true`, a warning banner is shown:
> "Your knowledge base is near capacity (80%). Consider removing uploaded documents."

The warning includes a link to manage/remove uploaded documents.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Returns correct shape | Unit: call endpoint → assert `{ bytes_used, bytes_limit, percent_used, is_near_capacity }` |
| `percent_used` calculated correctly | Unit: mock DB size at 400MB / 500MB → `percent_used === 80` |
| `is_near_capacity` true at ≥80% | Unit: mock 81% → `is_near_capacity === true` |
| `is_near_capacity` false at <80% | Unit: mock 79% → `is_near_capacity === false` |
| Warning shown in Settings at threshold | Manual: set mock bytes → Settings shows warning |
| RLS: user B sees own size only | RLS isolation test |
