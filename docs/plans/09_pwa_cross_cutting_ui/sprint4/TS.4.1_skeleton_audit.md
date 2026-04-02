# TS.4.1 — Loading Skeleton Audit

## Task
Audit all useQuery callsites to verify LoadingSkeleton coverage.

## Target
All components using `useQuery`

## Process
1. Run audit:
   ```bash
   grep -rn "useQuery" components/ app/ --include="*.tsx"
   ```
2. For each result: verify `isLoading` branch renders `<LoadingSkeleton />`
3. Fix any gaps: add LoadingSkeleton where missing
4. Document results in audit report

## Outputs
- Audit report: all useQuery callsites verified
- All gaps fixed

## Verify
- `grep useQuery` → every callsite has isLoading → LoadingSkeleton
- Throttle network → every page shows skeleton during load

## Handoff
→ TS.4.2 (Error audit)
