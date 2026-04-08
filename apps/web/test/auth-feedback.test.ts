import assert from "node:assert/strict";
import test from "node:test";

import {
  getFriendlyAuthErrorMessage,
  getPostAuthSuccessState,
  getPostSignOutState,
} from "../lib/auth-feedback.ts";

test("maps invalid credential errors to a concise sign-in message", () => {
  assert.equal(
    getFriendlyAuthErrorMessage("Invalid login credentials", "signin"),
    "Invalid credentials.",
  );
});

test("maps duplicate-email errors to a concise sign-up message", () => {
  assert.equal(
    getFriendlyAuthErrorMessage("User already registered", "signup"),
    "Email already in use.",
  );
});

test("preserves unknown auth errors so the UI can show the backend detail", () => {
  assert.equal(
    getFriendlyAuthErrorMessage("Temporary auth outage", "signin"),
    "Temporary auth outage",
  );
});

test("redirects successful sign-in and auto-confirmed sign-up to the dashboard", () => {
  assert.deepEqual(getPostAuthSuccessState("signin", true), {
    href: "/dashboard",
    kind: "redirect",
    message: "Signed in.",
  });
  assert.deepEqual(getPostAuthSuccessState("signup", true), {
    href: "/dashboard",
    kind: "redirect",
    message: "Organizer account created.",
  });
});

test("shows a confirmation state when sign-up succeeds without a live session", () => {
  assert.deepEqual(getPostAuthSuccessState("signup", false), {
    kind: "confirm-email",
    message: "Check your email to confirm your organizer account.",
  });
});

test("hard-redirects signed-out organizers to the public landing page", () => {
  assert.deepEqual(getPostSignOutState(), {
    href: "/",
    kind: "hard-redirect",
    message: "Signed out.",
  });
});
