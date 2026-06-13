import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicTicketUrl,
  filterOrganizerEvents,
  filterOrganizerTickets,
} from "../lib/organizer-dashboard.ts";

const events = [
  {
    event_id: "listed_live",
    is_listed: true,
    lifecycle: "active" as const,
    name: "Steep Summer Table",
  },
  {
    event_id: "private_future",
    is_listed: false,
    lifecycle: "upcoming" as const,
    name: "Private Preview",
  },
];

const tickets = [
  {
    attendee_email: "avery@example.com",
    attendee_name: "Avery Morgan",
    status: "claimed" as const,
    ticket_type_name: "General Admission",
  },
  {
    attendee_email: "imani@example.com",
    attendee_name: "Imani Patel",
    status: "enrolled" as const,
    ticket_type_name: "Supper seat",
  },
];

test("selects the configured ticket app origin without mixed or duplicate slashes", () => {
  assert.equal(
    buildPublicTicketUrl("http://192.168.1.20:3001/", "listed_live"),
    "http://192.168.1.20:3001/events/listed_live",
  );
  assert.equal(
    buildPublicTicketUrl("https://tickets.example.com", "private future"),
    "https://tickets.example.com/events/private%20future",
  );
});

test("filters organizer events by search, lifecycle, and listed state", () => {
  assert.deepEqual(
    filterOrganizerEvents(events, {
      lifecycle: "active",
      listed: "listed",
      query: "summer",
    }).map((event) => event.event_id),
    ["listed_live"],
  );
  assert.equal(
    filterOrganizerEvents(events, {
      lifecycle: "all",
      listed: "unlisted",
      query: "preview",
    }).length,
    1,
  );
});

test("filters tickets by trusted attendee fields, status, and type", () => {
  assert.deepEqual(
    filterOrganizerTickets(tickets, {
      query: "imani@",
      status: "enrolled",
      ticketType: "Supper seat",
    }).map((ticket) => ticket.attendee_name),
    ["Imani Patel"],
  );
  assert.equal(
    filterOrganizerTickets(tickets, {
      query: "missing",
      status: "all",
      ticketType: "all",
    }).length,
    0,
  );
});
