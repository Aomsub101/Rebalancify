# docs/design/03-screen-flows.md — Screen Flows & Layout Diagrams

## AGENT CONTEXT

**What this file is:** ASCII layout diagrams for every major page showing exact UI section positions, navigation state, empty states, and mobile variants.
**Derived from:** design_preferences.md Sections 4, 6, 10
**Connected to:** docs/architecture/04-component-tree.md (components shown here), docs/design/01-design-system.md (dimensions)
**Critical rules for agents using this file:**
- Sidebar is ALWAYS dark (#1E3A5F light / #111827 dark). No exceptions.
- Bottom tab bar replaces sidebar on mobile. 5 tabs: Overview, Silos, News, Discover, Settings.
- Horizontal table scroll with sticky first column on mobile — never card layout for tables.

---

## Overview Page — Desktop

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR 240px (dark navy)      │  TOP BAR (56px, var(--card) bg)        │
│                                │  [Overview]           [USD Toggle] [🔔]  │
│  [R] Rebalancify               ├────────────────────────────────────────│
│                                │                                         │
│  ──  NAVIGATION  ──────────    │  PAGE CONTENT  max-w-7xl px-6          │
│  ◉  Overview      ← active    │                                         │
│  ⊞  Silos  [3/5]              │  ┌─────────────────────────────────┐    │
│  ◈  News                      │  │ PortfolioSummaryCard             │    │
│  ◎  Discover                  │  │ Total: $24,890.00 · 3 silos      │    │
│  ─────────────────────────    │  │ 12 assets · 2 assets breached   │    │
│  ⚙  Settings                  │  └─────────────────────────────────┘    │
│  ─────────────────────────    │                                         │
│  [👤] Display Name            │  GlobalDriftBanner (if breached, red)   │
│  user@email.com  [Sign out]   │  "AAPL +6.2%, BTC -8.1% threshold"     │
│                                │                                         │
│                                │  SiloCardGrid (3-col on xl)            │
│                                │  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│                                │  │ Alpaca   │ │ BITKUB   │ │ DIME   │ │
│                                │  │ $12,450  │ │ ฿89,200  │ │ ฿45,000│ │
│                                │  │ [API][AUTO]│ [API][MAN]│ [MANUAL]│ │
│                                │  │ ● 2 ok  │ │ ▲ 1 near │ │ ● ok  │ │
│                                │  └──────────┘ └──────────┘ └────────┘ │
│                                │                                         │
│                                │  TopMoversWidget (preview)              │
│                                │  [US Stocks ▾]  NVDA +3.2% ...         │
└────────────────────────────────┴─────────────────────────────────────────┘
```

## Overview Page — Mobile

```
┌──────────────────────────────┐
│  TOP BAR (48px)              │
│  Overview         [👤]       │
├──────────────────────────────┤
│  PortfolioSummaryCard        │
│  Total: $24,890.00           │
│  3 silos · 12 assets         │
├──────────────────────────────┤
│  GlobalDriftBanner (if any)  │
├──────────────────────────────┤
│  SiloCard (stacked 1-col)    │
│  ┌────────────────────────┐  │
│  │ Alpaca       $12,450   │  │
│  │ [API][AUTO]  ● 2 ok    │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ BITKUB       ฿89,200   │  │
│  │ [API][MAN]   ▲ 1 near  │  │
│  └────────────────────────┘  │
├──────────────────────────────┤
│  BOTTOM TAB BAR (56px)       │
│  [◉]  [⊞]  [◈]  [◎]  [⚙]  │
│  Ov  Silos  News  Dis  Set  │
└──────────────────────────────┘
```

---

## Silo Detail Page — Desktop

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR (dark)                 │  TOP BAR                                │
│ ⊞  Silos  ← active            │  [Alpaca Portfolio]   [Sync] [🔔]        │
├────────────────────────────────┼─────────────────────────────────────────┤
│                                │  SiloHeader                             │
│                                │  Alpaca Portfolio  [API][AUTO]  USD     │
│                                │  Last synced: 14 min ago  [Sync button] │
│                                │  [LIVE] badge (if alpaca_mode='live')   │
│                                ├─────────────────────────────────────────┤
│                                │  SiloSummaryBar                         │
│                                │  Total: $12,450.00  Cash: $200.00       │
│                                │  ████████████░░░  95% allocated         │
│                                │  ⚠ "Weights sum to 95%..."              │
│                                ├─────────────────────────────────────────┤
│                                │  [+ Add asset]  [Run rebalance →]       │
│                                ├─────────────────────────────────────────┤
│                                │  HoldingsTable                          │
│                                │  TICKER  NAME        QTY   VALUE  CUR%  TGT%  DRIFT    │
│                                │  AAPL   Apple Inc   10   $1,852  18.5  20.0  -1.5% ●  │
│                                │  MSFT   Microsoft   5    $2,100  21.0  20.0  +1.0% ●  │
│                                │  BTC    Bitcoin     0.1  $6,500  65.5  60.0  +5.5% ▲  │
│                                │                                         │
│                                │  CashBalanceRow: $200 / 5% target       │
└────────────────────────────────┴─────────────────────────────────────────┘
```

## Silo Detail Page — Mobile

```
┌──────────────────────────────┐
│  TOP BAR                     │
│  Alpaca Portfolio   [Sync]   │
├──────────────────────────────┤
│  [API][AUTO][USD][LIVE]      │
│  Total: $12,450.00           │
│  ████████░ 95% allocated     │
│  ⚠ Weights sum to 95%       │
├──────────────────────────────┤
│  [+ Add asset] [Rebalance →] │
├──────────────────────────────┤
│  ← scrollable table →       │
│  TICKER │ VALUE  │ DRIFT     │
│  AAPL   │$1,852  │ -1.5% ●  │
│  MSFT   │$2,100  │ +1.0% ●  │
│  BTC    │$6,500  │ +5.5% ▲  │
│  (sticky first column)       │
└──────────────────────────────┘
```

---

## Rebalancing Wizard — Step 1 (Config) — Desktop

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR                        │  TOP BAR                                │
│ ⊞  Silos  ← active            │  [Rebalance — Alpaca Portfolio]         │
│                                ├─────────────────────────────────────────┤
│                                │  ① Config  →  ○ Review  →  ○ Result    │
│                                ├─────────────────────────────────────────┤
│                                │  Rebalancing Mode                       │
│                                │                                         │
│                                │  ┌────────────────┐ ┌────────────────┐ │
│                                │  │ ◉ Partial       │ │ ○ Full          │ │
│                                │  │ Minimise trades │ │ Exact weights   │ │
│                                │  │ ±1-2% residual  │ │ ±0.01% target  │ │
│                                │  └────────────────┘ └────────────────┘ │
│                                │                                         │
│                                │  ⚠ [Full Rebalance Warning] if full     │
│                                │                                         │
│                                │  ☐ Include cash in rebalancing          │
│                                │  [$500.00    ] cash to deploy           │
│                                │                                         │
│                                │  ⚠ Weights sum to 95%... (if ≠ 100%)   │
│                                │                                         │
│                                │  [← Cancel]           [Calculate →]    │
└────────────────────────────────┴─────────────────────────────────────────┘
```

---

## Rebalancing Wizard — Step 2 (Review) — Desktop

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR                        │  ○ Config  →  ② Review  →  ○ Result    │
│                                ├─────────────────────────────────────────┤
│                                │  SessionSummaryBar                      │
│                                │  3 buys · 2 sells · Net: -$234          │
│                                ├─────────────────────────────────────────┤
│                                │  ⚠ [ExecutionModeNotice] (non-Alpaca)   │
│                                │  "These orders will not be submitted    │
│                                │  automatically. Execute manually on..." │
│                                ├─────────────────────────────────────────┤
│                                │  OrdersTable                            │
│                                │  TICKER  TYPE  QTY  VALUE  BEFORE→AFTER SKIP │
│                                │  AAPL   [BUY]  2   $370   18.5%→20.0%  ☐   │
│                                │  MSFT   [SELL] 1   $420   21.0%→20.0%  ☐   │
│                                │  BTC    [SELL] 0.05 $325  65.5%→60.0%  ☐   │
│                                │                                         │
│                                │  [← Back]              [Execute orders →] │
│                                │                           (primary btn) │
└────────────────────────────────┴─────────────────────────────────────────┘
```

---

## Rebalancing Wizard — Step 3 (Result) — Desktop

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR                        │  ○ Config  →  ○ Review  →  ③ Result    │
│                                ├─────────────────────────────────────────┤
│                                │  ✓ Submitted to Alpaca (3 orders)       │
│                                │  AAPL BUY 2 — executed  ✓               │
│                                │  MSFT SELL 1 — executed ✓               │
│                                │  BTC  SELL 0.05 — skipped (you skipped) │
│                                ├─────────────────────────────────────────┤
│                                │  (for non-Alpaca silos instead:)        │
│                                │  Execute these orders manually on BITKUB│
│                                │  • BUY 0.01 BTC-THB at market           │
│                                │  • SELL 100 ETH-THB at market           │
│                                ├─────────────────────────────────────────┤
│                                │              [← Back to silo]            │
└────────────────────────────────┴─────────────────────────────────────────┘
```

---

## News Page — Desktop + Mobile

```
DESKTOP:
┌─────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR          │  [Portfolio News]  [Macro News]      (tabs)          │
│                  │  Last updated 8 min ago        [Refresh ↺]          │
│                  │  ⚠ Rate limit — [amber banner, collapsible]          │
│                  │  ─────────────────────────────────────────────────   │
│                  │  ArticleCard                                          │
│                  │  AAPL MSFT  Apple's Services growth exceeds...        │
│                  │  Finnhub · 2 hours ago · [Read original ↗]           │
│                  │  ─────────────────────────────────────────────────   │
│                  │  ArticleCard ...                                      │
└──────────────────┴──────────────────────────────────────────────────────┘

MOBILE (max-w-3xl):
┌──────────────────────────────┐
│  [Portfolio News][Macro News]│
│  8 min ago       [Refresh]   │
├──────────────────────────────┤
│  [AAPL][MSFT]                │
│  Apple's Services growth...  │
│  Finnhub · 2h ago  [↗]      │
├──────────────────────────────┤
│  BOTTOM TAB BAR              │
└──────────────────────────────┘
```

---

## Discover Page — Desktop

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR          │  TOP BAR: [Discover]                                  │
│ ◎ Discover ←    ├───────────────────────────────────────────────────────┤
│                  │  [US Stocks ▾]  [Crypto ▾]        (TopMoversTabs)    │
│                  │                                                        │
│                  │  TOP GAINERS              TOP LOSERS                   │
│                  │  NVDA +3.2% $875.40       TSLA -2.1% $178.20          │
│                  │  AMD  +2.8% $142.60       META -1.8% $490.10          │
│                  │                                                        │
│                  │  ─────────────────────────────────────────────────    │
│                  │  Find related assets                                   │
│                  │  [Search ticker...                          🔍]        │
│                  │                                                        │
│                  │  PeerCard grid (4-col lg):                             │
│                  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                │
│                  │  │ AMD  │ │INTC  │ │QCOM  │ │AVGO  │                │
│                  │  │$142  │ │$42   │ │$160  │ │$1210 │                │
│                  │  └──────┘ └──────┘ └──────┘ └──────┘                │
│                  │                                                        │
│                  │  ─────────────────────────────────────────────────    │
│                  │  Portfolio Drift Summary                               │
│                  │  Alpaca: AAPL ● -1.5%  MSFT ● +1.0%  BTC ▲ +5.5%   │
└──────────────────┴────────────────────────────────────────────────────────┘
```

---

## Settings Page — Desktop

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR          │  Settings                         max-w-2xl           │
│ ⚙ Settings ←    ├───────────────────────────────────────────────────────┤
│                  │  Profile                                               │
│                  │  Display Name: [John Smith        ]  [Save]           │
│                  │                                                        │
│                  │  Notifications                                         │
│                  │  Drift alerts: (◉) Both  (○) App only  (○) Email      │
│                  │                                                        │
│                  │  Silo Usage                                            │
│                  │  ████████████░░░  3 / 5 silos used                    │
│                  │                                                        │
│                  │  Connected Platforms                                   │
│                  │  ┌ Alpaca ─────────────────────────────────────────┐  │
│                  │  │ ● Connected · (◉) Paper  (○) Live               │  │
│                  │  │ API Key:    [••••••••          ] [👁]            │  │
│                  │  │ API Secret: [••••••••          ] [👁]  [Save]   │  │
│                  │  └─────────────────────────────────────────────────┘  │
│                  │  ┌ BITKUB ──────────────────────────────────────────┐ │
│                  │  │ ○ Not connected                                   │ │
│                  │  │ API Key:    [                  ] [Save]          │ │
│                  │  └─────────────────────────────────────────────────┘  │
│                  │  [Schwab — OAuth Connect button]                       │
│                  │  [InnovestX — key/secret]                              │
│                  │  [Webull — key/secret + $500 note]                    │
│                  │                                                        │
│                  │  AI Research Key (v2.0)                                │
│                  │  Provider: [Google AI Studio (Free tier) ▾]            │
│                  │  Model:    [gemini-2.0-flash              ▾]            │
│                  │  API Key:  [                              ] [Save]     │
│                  │                                                        │
│                  │  ─────────────────────── Danger Zone ─────────────    │
│                  │  [Delete Account] (destructive, opens ConfirmDialog)   │
└──────────────────┴────────────────────────────────────────────────────────┘
```

---

## Onboarding Modal (First Login Only)

```
┌──────────────────────────────────────────────────────────────┐
│  Welcome to Rebalancify                                      │
│  ─────────────────────────────────────────────────────────   │
│  Which platform do you invest on first?                      │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │  Alpaca  │ │  BITKUB  │ │InnovestX │                    │
│  │  [icon]  │ │  [icon]  │ │  [icon]  │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │  Schwab  │ │  Webull  │ │   DIME   │                    │
│  │  [icon]  │ │  [icon]  │ │  [icon]  │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  + Other platform (enter manually)                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│                                           [Skip for now]    │
└──────────────────────────────────────────────────────────────┘
```

**After platform selection:** Modal closes → silo pre-created → user lands on silo detail → progress banner appears.

**Progress banner (post-onboarding, dismissible):**
```
┌────────────────────────────────────────────────────────────────────┐
│  ● Add holdings  →  ○ Set target weights  →  ○ Run first rebalance  [✕] │
└────────────────────────────────────────────────────────────────────┘
```
