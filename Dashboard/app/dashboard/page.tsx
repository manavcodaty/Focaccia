import { redirect } from 'next/navigation'

// This legacy route redirects to the main dashboard in the (dashboard) route group.
export default function LegacyDashboardPage() {
  redirect('/')
}
