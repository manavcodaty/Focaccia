import { RevocationsLogsView } from '@/components/revocations-logs-view'

// ── Backend engineer: fetch revocation + access logs by eventId ──
// e.g. const { data } = await fetchEventLogs(params.eventId)
// Then: <RevocationsLogsView {...data} />

export default function RevocationsLogsPage() {
  return <RevocationsLogsView />
}
