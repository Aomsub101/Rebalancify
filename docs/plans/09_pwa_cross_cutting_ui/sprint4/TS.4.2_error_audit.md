# TS.4.2 — Error Banner Audit

## Task
Audit all useQuery callsites to verify ErrorBanner coverage.

## Target
All components using `useQuery`

## Process
1. Run audit:
   ```bash
   grep -rn "useQuery" components/ app/ --include="*.tsx"
   ```
2. For each result: verify `isError` branch renders `<ErrorBanner />`
3. Fix any gaps: add ErrorBanner with retry handler
4. Document results in audit report

## Outputs
- Audit report: all useQuery callsites verified
- All gaps fixed

## Verify
- `grep useQuery` → every callsite has isError → ErrorBanner
- Mock API failures → ErrorBanner with retry on every page

## Handoff
→ TS.4.3 (Performance audit)
