# TS.3.1 — AppShell Layout

## Task
Create the authenticated dashboard layout wrapper that renders Sidebar, TopBar, OfflineBanner, and page content.

## Target
`app/(dashboard)/layout.tsx`

## Inputs
- TS.2.4 outputs (middleware protects these routes)
- `docs/architecture/components/01_auth_foundation/app_shell_layout.md`
- `docs/architecture/04-component-tree.md` §2.1

## Process
1. Create `app/(dashboard)/layout.tsx`:
   - Wraps all dashboard pages
   - Renders: Sidebar (desktop), BottomTabBar (mobile), TopBar, OfflineBanner, `{children}`
   - Uses responsive breakpoint: Sidebar visible >= 768px, BottomTabBar visible < 768px
   - Background: `bg-background` (light/dark aware)
2. Layout structure:
   ```
   <div className="flex h-screen">
     <Sidebar className="hidden md:flex" />
     <div className="flex-1 flex flex-col">
       <TopBar />
       <OfflineBanner />
       <main className="flex-1 overflow-auto p-4 md:p-6">
         {children}
       </main>
     </div>
     <BottomTabBar className="md:hidden" />
   </div>
   ```
3. Wrap children with SessionContext provider (TS.4.1)

## Outputs
- `app/(dashboard)/layout.tsx`

## Verify
- All dashboard pages render inside the shell
- Sidebar visible on desktop, BottomTabBar on mobile
- Content area scrolls independently

## Handoff
→ TS.3.2 (Sidebar component)
