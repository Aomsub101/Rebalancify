# Rebalancify

An open-source portfolio management tool for retail investors holding assets across multiple platforms. It centralises holdings, calculates precise rebalancing orders based on user-defined target weights, and surfaces market news and asset insights — leaving every allocation decision and trade execution strictly in the user's hands.

## Tech Stack

| Technology | Role |
|---|---|
| Next.js 14 | Full-stack React framework (App Router) |
| TypeScript | Static typing across the entire codebase |
| Tailwind CSS | Utility-first styling |
| Supabase | PostgreSQL database, Auth, and pgvector |
| React Query | Server-state management and data fetching |
| Vercel | Hosting and CI/CD |

## Getting Started (Local Development)

1. **Clone the repo**
   ```bash
   git clone git@github.com:Aomsub101/Rebalancify.git
   cd Rebalancify
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and fill in the values for your Supabase project and API keys.

4. **Run the database migration**

   Open your Supabase project's SQL editor and run the contents of:
   ```
   supabase/migrations/0001_initial_schema.sql
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                  # Next.js App Router pages and layouts
│   ├── (auth)/           # Auth group: login, signup, reset-password
│   ├── (dashboard)/      # Dashboard group: overview, silos, news, discover, settings
│   └── api/              # API route handlers
├── components/
│   ├── ui/               # Primitive UI components (buttons, inputs, modals)
│   ├── layout/           # Layout components (navbar, sidebar, page wrappers)
│   └── features/         # Domain-specific feature components
├── lib/
│   ├── supabase/         # Supabase client utilities (browser, server, middleware)
│   ├── api/              # External API clients (Finnhub, FMP, Alpaca)
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Pure utility functions
└── types/                # Shared TypeScript interfaces and types
```

## Documentation

Full project documentation is available in the `/docs` folder (coming soon):

- **PRD** — Product Requirements Document
- **Data Model** — Entity relationships and schema design
- **API Contract** — All internal API endpoints and shapes
- **Component Tree** — UI component hierarchy
- **ADR** — Architecture Decision Records
- **Build Order** — Phased implementation plan

## License

MIT
