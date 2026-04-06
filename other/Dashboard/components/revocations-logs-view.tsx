'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  ShieldX,
  History,
  Search,
  Download,
  UserX,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

// ============================================================
// PROP INTERFACES — Backend engineer should implement these:
//
// RevocationLog:
//   id: string              — Unique log entry ID
//   ticketId: string        — Ticket being revoked
//   userId: string          — User ID associated with ticket
//   revokedBy: string       — Admin/organizer who revoked
//   revokedAt: string       — ISO timestamp
//   reason?: string         — Optional reason for revocation
//
// AccessLog:
//   id: string              — Unique log entry ID
//   ticketId: string        — Ticket scanned
//   gateId: string          — Gate where access attempt occurred
//   gateName: string        — Human-readable gate name
//   userId?: string         — User ID if known
//   timestamp: string       — ISO timestamp
//   status: 'granted' | 'denied' | 'error'
//   reason?: string         — Details (e.g., "Ticket already used")
//
// RevocationsLogsViewProps:
//   eventId: string
//   eventName: string
//   revocationLogs: RevocationLog[]
//   accessLogs: AccessLog[]
//   onRevokeTicket?: (ticketId: string, reason: string) => Promise<void>
//   onExportLogs?: (type: 'revocations' | 'access') => void
//   isLoading?: boolean
// ============================================================

export interface RevocationLog {
  id: string
  ticketId: string
  userId: string
  revokedBy: string
  revokedAt: string
  reason?: string
}

export interface AccessLog {
  id: string
  ticketId: string
  gateId: string
  gateName: string
  userId?: string
  timestamp: string
  status: 'granted' | 'denied' | 'error'
  reason?: string
}

export interface RevocationsLogsViewProps {
  eventId?: string
  eventName?: string
  revocationLogs?: RevocationLog[]
  accessLogs?: AccessLog[]
  onRevokeTicket?: (ticketId: string, reason: string) => Promise<void>
  onExportLogs?: (type: 'revocations' | 'access') => void
  isLoading?: boolean
}

// ── MOCK DATA ──────────────────────────────────────────────
const MOCK_EVENT_ID = 'evt_001'
const MOCK_EVENT_NAME = 'Summer Music Festival 2026'

const MOCK_REVOCATION_LOGS: RevocationLog[] = [
  {
    id: 'rev_001',
    ticketId: 'tkt_a7b3c2',
    userId: 'usr_45678',
    revokedBy: 'admin@focaccia.io',
    revokedAt: '2026-07-15T14:32:10Z',
    reason: 'Duplicate ticket detected',
  },
  {
    id: 'rev_002',
    ticketId: 'tkt_f9d2e1',
    userId: 'usr_98765',
    revokedBy: 'organizer@focaccia.io',
    revokedAt: '2026-07-15T12:15:00Z',
    reason: 'Fraudulent purchase',
  },
  {
    id: 'rev_003',
    ticketId: 'tkt_c4d8a3',
    userId: 'usr_11223',
    revokedBy: 'admin@focaccia.io',
    revokedAt: '2026-07-14T19:45:22Z',
  },
]

const MOCK_ACCESS_LOGS: AccessLog[] = [
  {
    id: 'acc_001',
    ticketId: 'tkt_b3c4d5',
    gateId: 'gate_001',
    gateName: 'Main Entrance',
    userId: 'usr_22334',
    timestamp: '2026-07-15T18:05:12Z',
    status: 'granted',
  },
  {
    id: 'acc_002',
    ticketId: 'tkt_e6f7g8',
    gateId: 'gate_002',
    gateName: 'VIP Entrance',
    userId: 'usr_33445',
    timestamp: '2026-07-15T18:03:45Z',
    status: 'granted',
  },
  {
    id: 'acc_003',
    ticketId: 'tkt_a7b3c2',
    gateId: 'gate_001',
    gateName: 'Main Entrance',
    userId: 'usr_45678',
    timestamp: '2026-07-15T17:58:30Z',
    status: 'denied',
    reason: 'Ticket revoked',
  },
  {
    id: 'acc_004',
    ticketId: 'tkt_h9i0j1',
    gateId: 'gate_003',
    gateName: 'Staff Access',
    timestamp: '2026-07-15T17:50:00Z',
    status: 'error',
    reason: 'Gate offline',
  },
  {
    id: 'acc_005',
    ticketId: 'tkt_k2l3m4',
    gateId: 'gate_001',
    gateName: 'Main Entrance',
    userId: 'usr_55667',
    timestamp: '2026-07-15T17:42:18Z',
    status: 'granted',
  },
]
// ──────────────────────────────────────────────────────────

export function RevocationsLogsView({
  eventId = MOCK_EVENT_ID,
  eventName = MOCK_EVENT_NAME,
  revocationLogs = MOCK_REVOCATION_LOGS,
  accessLogs = MOCK_ACCESS_LOGS,
  onExportLogs,
  isLoading = false,
}: RevocationsLogsViewProps) {
  const [revSearchQuery, setRevSearchQuery] = useState('')
  const [accessSearchQuery, setAccessSearchQuery] = useState('')
  const [accessStatusFilter, setAccessStatusFilter] = useState<string>('all')

  // Filter revocation logs
  const filteredRevocations = revocationLogs.filter(
    (log) =>
      log.ticketId.toLowerCase().includes(revSearchQuery.toLowerCase()) ||
      log.userId.toLowerCase().includes(revSearchQuery.toLowerCase())
  )

  // Filter access logs
  const filteredAccessLogs = accessLogs.filter((log) => {
    const matchesSearch =
      log.ticketId.toLowerCase().includes(accessSearchQuery.toLowerCase()) ||
      log.gateName.toLowerCase().includes(accessSearchQuery.toLowerCase())
    const matchesStatus = accessStatusFilter === 'all' || log.status === accessStatusFilter
    return matchesSearch && matchesStatus
  })

  function handleExport(type: 'revocations' | 'access') {
    if (onExportLogs) {
      onExportLogs(type)
    } else {
      console.log('[Focaccia] Export triggered for:', type)
    }
  }

  function formatTimestamp(isoString: string) {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  function getStatusIcon(status: AccessLog['status']) {
    switch (status) {
      case 'granted':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'denied':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-balance">
          Revocations & Access Logs
        </h1>
        <p className="text-muted-foreground mt-1">{eventName}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="access" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="access" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Access Logs
          </TabsTrigger>
          <TabsTrigger value="revocations" className="flex items-center gap-2">
            <ShieldX className="h-4 w-4" />
            Revocations
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ACCESS LOGS TAB */}
        {/* ═══════════════════════════════════════════════════════ */}
        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Access Logs
                  </CardTitle>
                  <CardDescription>
                    All gate scan attempts for this event ({accessLogs.length} total)
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('access')}
                  disabled={isLoading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ticket ID or gate name..."
                    value={accessSearchQuery}
                    onChange={(e) => setAccessSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={accessStatusFilter} onValueChange={setAccessStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="granted">Granted</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Ticket ID</TableHead>
                      <TableHead>Gate</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccessLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No access logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAccessLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(log.status)}
                              <span className="capitalize text-sm">{log.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{log.ticketId}</TableCell>
                          <TableCell>{log.gateName}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {log.userId || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.reason || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* REVOCATIONS TAB */}
        {/* ═══════════════════════════════════════════════════════ */}
        <TabsContent value="revocations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldX className="h-5 w-5" />
                    Revoked Tickets
                  </CardTitle>
                  <CardDescription>
                    All tickets revoked for this event ({revocationLogs.length} total)
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('revocations')}
                  disabled={isLoading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ticket ID or user ID..."
                  value={revSearchQuery}
                  onChange={(e) => setRevSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket ID</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Revoked By</TableHead>
                      <TableHead>Revoked At</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRevocations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No revocations found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRevocations.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-2">
                              <UserX className="h-3.5 w-3.5 text-destructive" />
                              {log.ticketId}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {log.userId}
                          </TableCell>
                          <TableCell className="text-sm">{log.revokedBy}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTimestamp(log.revokedAt)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.reason || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
