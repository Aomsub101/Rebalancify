import { redirect } from 'next/navigation'

// Middleware redirects unauthenticated users to /login before this runs.
// Authenticated users landing on / are sent to /overview.
export default function RootPage() {
  redirect('/overview')
}
