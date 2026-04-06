'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Copy, Check, PlusCircle, QrCode, Key, ShieldCheck, Info } from 'lucide-react'
import Link from 'next/link'

// ============================================================
// MOCK DATA — Backend engineer should replace with real data.
//
// GateProvisioningViewProps:
//   eventId: string           — ID of the parent event
//   eventName: string         — Human-readable event name
//   eventSalt: string         — Cryptographic salt tied to this event
//   gates: GateData[]         — List of provisioned gates
//
// GateData:
//   id: string                — Unique gate identifier
//   name: string              — Display label (e.g. "Main Entrance")
//   publicKey: string         — Ed25519 public key (Base64 or hex)
//   qrCodeUrl?: string        — Pre-generated QR code image URL (optional)
//   createdAt: string         — ISO timestamp
//   isActive: boolean         — Whether the gate is currently active
//
// onAddGate()                 — Callback to trigger gate key generation
// onRevokeGate(id: string)    — Callback to revoke a specific gate
// isLoading: boolean          — True while API calls are in flight
// ============================================================
export interface GateData {
  id: string
  name: string
  publicKey: string
  qrCodeUrl?: string
  createdAt: string
  isActive: boolean
}

export interface GateProvisioningViewProps {
  eventId?: string
  eventName?: string
  eventSalt?: string
  gates?: GateData[]
  onAddGate?: () => void
  onRevokeGate?: (id: string) => void
  isLoading?: boolean
}

// ── MOCK DATA ──────────────────────────────────────────────
const MOCK_EVENT_ID = 'evt_001'
const MOCK_EVENT_NAME = 'Summer Music Festival 2026'
const MOCK_EVENT_SALT =
  'a3f8c2e1d7b4906582fc7d3a1e8b5c0d4f2a9e6b3c7d1f8a5e2b0c4d6f9a1e3'
const MOCK_GATES: GateData[] = [
  {
    id: 'gate_001',
    name: 'Main Entrance',
    publicKey:
      'MCowBQYDK2VwAyEAYqCGT7wr9XWGK8sFJIYxe5o0DZlPBm/QpvH+z3Ua7Rw=',
    createdAt: '2026-06-01T09:00:00Z',
    isActive: true,
  },
  {
    id: 'gate_002',
    name: 'VIP Entrance',
    publicKey:
      'MCowBQYDK2VwAyEAN8TbGLf5cXjHWpkKq2a3eDRvPsCzJlmo0tUn1Yid4Qk=',
    createdAt: '2026-06-01T09:05:00Z',
    isActive: true,
  },
  {
    id: 'gate_003',
    name: 'Staff Access',
    publicKey:
      'MCowBQYDK2VwAyEAR1hXoP9sGcIq6mBuA5wL4Ney8KvTWdJ2pFnk7MjZ3Hs=',
    createdAt: '2026-06-01T09:10:00Z',
    isActive: false,
  },
]
// ──────────────────────────────────────────────────────────

// Truncate long keys for display
function truncateKey(key: string, chars = 32): string {
  return key.length > chars ? `${key.slice(0, chars)}…` : key
}

// Copy-to-clipboard hook
function useCopyToClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }
  return { copiedId, copy }
}

export function GateProvisioningView({
  eventId = MOCK_EVENT_ID,
  eventName = MOCK_EVENT_NAME,
  eventSalt = MOCK_EVENT_SALT,
  gates = MOCK_GATES,
  onAddGate,
  onRevokeGate,
  isLoading = false,
}: GateProvisioningViewProps) {
  const { copiedId, copy } = useCopyToClipboard()

  // ── MOCK handlers — remove once real callbacks are passed ──
  function handleAddGate() {
    if (onAddGate) {
      onAddGate()
    } else {
      console.log('[Focaccia] Add gate triggered for event:', eventId)
    }
  }

  function handleRevokeGate(id: string) {
    if (onRevokeGate) {
      onRevokeGate(id)
    } else {
      console.log('[Focaccia] Revoke gate triggered:', id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Link>
        </Button>
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">Gate Provisioning</h1>
          <p className="text-muted-foreground mt-1">{eventName}</p>
        </div>
        <Button onClick={handleAddGate} disabled={isLoading}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Gate
        </Button>
      </div>

      {/* Event Salt Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5" />
            Event Salt
          </CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            This cryptographic salt is unique to this event. It is used alongside each gate&apos;s
            public key to derive ticket signatures. Keep this value confidential.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border bg-muted p-3 font-mono text-sm break-all">
            <span className="flex-1 text-foreground">{eventSalt}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => copy(eventSalt, 'salt')}
              aria-label="Copy event salt"
            >
              {copiedId === 'salt' ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gates List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Configured Gates
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({gates.length} total)
          </span>
        </h2>

        {gates.length === 0 && (
          <Card className="p-10">
            <div className="flex flex-col items-center text-center">
              <Key className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">No gates provisioned yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click &ldquo;Add Gate&rdquo; to generate a key pair for your first entrance point.
              </p>
            </div>
          </Card>
        )}

        {gates.map((gate) => (
          <Card key={gate.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">{gate.name}</CardTitle>
                  <Badge
                    variant={gate.isActive ? 'default' : 'secondary'}
                    className={gate.isActive ? 'bg-primary text-primary-foreground' : ''}
                  >
                    {gate.isActive ? 'Active' : 'Revoked'}
                  </Badge>
                </div>
                {gate.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeGate(gate.id)}
                    disabled={isLoading}
                    className="text-destructive hover:text-destructive"
                  >
                    Revoke
                  </Button>
                )}
              </div>
              <CardDescription>
                Gate ID: <span className="font-mono">{gate.id}</span> &middot; Provisioned{' '}
                {new Date(gate.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Public Key */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" />
                  Public Key
                </p>
                <div className="flex items-center gap-3 rounded-md border bg-muted p-3 font-mono text-sm">
                  <span className="flex-1 break-all">{gate.publicKey}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copy(gate.publicKey, `key-${gate.id}`)}
                    aria-label="Copy public key"
                  >
                    {copiedId === `key-${gate.id}` ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* QR Code Placeholder */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5" />
                  QR Code
                </p>
                {gate.qrCodeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={gate.qrCodeUrl}
                    alt={`QR code for ${gate.name}`}
                    className="h-32 w-32 rounded-md border"
                  />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-md border bg-muted">
                    <div className="flex flex-col items-center text-center text-muted-foreground">
                      <QrCode className="h-8 w-8 mb-1" />
                      <span className="text-xs px-2">
                        QR code will be generated by backend
                        {/* Backend: set gate.qrCodeUrl to the generated QR image URL */}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
