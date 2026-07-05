import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

it("landing app emits baseline browser security headers", () => {
  const config = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");

  for (const required of [
    "poweredByHeader: false",
    "headers()",
    "Content-Security-Policy",
    "frame-ancestors 'none'",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "X-Frame-Options",
    "Permissions-Policy",
  ]) {
    expect(config).toContain(required);
  }
});
