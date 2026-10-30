import assert from "node:assert/strict";
import test from "node:test";

import { formatTimestamp } from "../lib/format-timestamp.ts";

test("formats organizer timestamps identically across host timezones", () => {
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Asia/Dubai", "America/New_York"]) {
      process.env.TZ = timezone;
      assert.equal(formatTimestamp("2026-10-01T12:25:00Z"), "1 Oct 2026, 12:25 UTC");
      assert.equal(formatTimestamp("2026-01-01T00:05:00+04:00"), "31 Dec 2025, 20:05 UTC");
      assert.equal(formatTimestamp("2028-02-29T00:05:00Z"), "29 Feb 2028, 00:05 UTC");
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("preserves missing timestamp text and rejects invalid timestamps", () => {
  assert.equal(formatTimestamp(null), "Never");
  assert.throws(() => formatTimestamp("invalid"), RangeError);
});
