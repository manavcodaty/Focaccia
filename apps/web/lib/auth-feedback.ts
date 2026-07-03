export type AuthMode = "signin" | "signup";

export type PostAuthSuccessState =
  | {
      href: "/dashboard";
      kind: "redirect";
      message: "Signed in." | "Organizer account created.";
    }
  | {
      kind: "confirm-email";
      message: "Check your email to confirm your organizer account.";
    };

export interface PostSignOutState {
  href: "/";
  kind: "hard-redirect";
  message: "Signed out.";
}

export function getFriendlyAuthErrorMessage(message: string, mode: AuthMode): string {
  const normalized = message.trim().toLowerCase();

  if (
    normalized === "failed to fetch" ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed")
  ) {
    return "Unable to reach the organizer sign-in service. Check the selected Focaccia network mode and Supabase URL, then restart the local Supabase stack.";
  }

  if (
    mode === "signin" &&
    (normalized.includes("invalid login credentials") ||
      normalized.includes("invalid credentials"))
  ) {
    return "Invalid credentials.";
  }

  if (
    mode === "signup" &&
    (normalized.includes("already registered") ||
      normalized.includes("already exists") ||
      normalized.includes("user already exists"))
  ) {
    return "Email already in use.";
  }

  return message;
}

export function getPostAuthSuccessState(
  mode: AuthMode,
  hasSession: boolean,
): PostAuthSuccessState {
  if (mode === "signin") {
    return {
      href: "/dashboard",
      kind: "redirect",
      message: "Signed in.",
    };
  }

  if (hasSession) {
    return {
      href: "/dashboard",
      kind: "redirect",
      message: "Organizer account created.",
    };
  }

  return {
    kind: "confirm-email",
    message: "Check your email to confirm your organizer account.",
  };
}

export function getPostSignOutState(): PostSignOutState {
  return {
    href: "/",
    kind: "hard-redirect",
    message: "Signed out.",
  };
}
