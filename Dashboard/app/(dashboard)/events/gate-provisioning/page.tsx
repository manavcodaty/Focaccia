import { GateProvisioningView } from '@/components/gate-provisioning-view'

// ── Backend engineer: fetch gate data by eventId and pass as props ──
// e.g. const { data } = await fetchEventGates(params.eventId)
// Then: <GateProvisioningView {...data} />

export default function GateProvisioningPage() {
  return <GateProvisioningView />
}
