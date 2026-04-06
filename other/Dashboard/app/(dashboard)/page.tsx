import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Calendar, Clock, Users, MapPin } from 'lucide-react'
import Link from 'next/link'

// ============================================================
// MOCK DATA - Backend engineer should replace with real data
// ============================================================
const MOCK_EVENTS = [
  {
    id: 'evt_001',
    name: 'Summer Music Festival 2026',
    startTime: '2026-07-15T18:00:00Z',
    endTime: '2026-07-15T23:00:00Z',
    status: 'active',
    totalGates: 4,
    totalAttendees: 1247,
    location: 'Golden Gate Park, SF',
  },
  {
    id: 'evt_002',
    name: 'Tech Conference 2026',
    startTime: '2026-08-20T09:00:00Z',
    endTime: '2026-08-22T18:00:00Z',
    status: 'active',
    totalGates: 6,
    totalAttendees: 523,
    location: 'Moscone Center, SF',
  },
  {
    id: 'evt_003',
    name: 'Charity Gala Dinner',
    startTime: '2026-09-10T19:00:00Z',
    endTime: '2026-09-10T23:30:00Z',
    status: 'scheduled',
    totalGates: 2,
    totalAttendees: 0,
    location: 'Grand Ballroom, Palace Hotel',
  },
]

// Format date to human-readable string
function formatDateTime(isoString: string) {
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">Active Events</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your live and scheduled events
          </p>
        </div>
        <Button asChild>
          <Link href="/events/create">Create Event</Link>
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_EVENTS.length}</div>
            <p className="text-xs text-muted-foreground">
              {MOCK_EVENTS.filter((e) => e.status === 'active').length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gates</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {MOCK_EVENTS.reduce((sum, e) => sum + e.totalGates, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attendees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {MOCK_EVENTS.reduce((sum, e) => sum + e.totalAttendees, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Checked in today</p>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Events</h2>
        {MOCK_EVENTS.map((event) => (
          <Card key={event.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                    <Badge
                      variant={event.status === 'active' ? 'default' : 'secondary'}
                      className={
                        event.status === 'active'
                          ? 'bg-primary text-primary-foreground'
                          : ''
                      }
                    >
                      {event.status === 'active' ? 'Active' : 'Scheduled'}
                    </Badge>
                  </div>
                  <CardDescription className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.location}
                    </span>
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/events/${event.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Start</div>
                    <div className="text-muted-foreground text-xs">
                      {formatDateTime(event.startTime)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">End</div>
                    <div className="text-muted-foreground text-xs">
                      {formatDateTime(event.endTime)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Gates</div>
                    <div className="text-muted-foreground text-xs">
                      {event.totalGates} configured
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Attendees</div>
                    <div className="text-muted-foreground text-xs">
                      {event.totalAttendees.toLocaleString()} checked in
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State - shown when no events */}
      {MOCK_EVENTS.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No events yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Get started by creating your first event. You&apos;ll be able to manage gates,
              attendees, and access logs.
            </p>
            <Button asChild>
              <Link href="/events/create">Create Your First Event</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
