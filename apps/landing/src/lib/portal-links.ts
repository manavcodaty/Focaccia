export interface LandingPortalLinks {
  readonly attendeeHref: string;
  readonly organizerHref: string;
}

const DEFAULT_TICKETS_ORIGIN = "http://127.0.0.1:3001";
const DEFAULT_WEB_ORIGIN = "http://127.0.0.1:3000";

function selectedOrigin(value: string | undefined, fallback: string, name: string): string {
  const selected = value?.trim() || fallback;

  try {
    return new URL(selected).origin;
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

function withPath(origin: string, pathname: string): string {
  const url = new URL(origin);
  url.pathname = pathname;
  return url.toString().replace(/\/$/, "");
}

export function getLandingPortalLinks(): LandingPortalLinks {
  const ticketsOrigin = selectedOrigin(
    process.env.NEXT_PUBLIC_FOCACCIA_TICKETS_URL,
    DEFAULT_TICKETS_ORIGIN,
    "NEXT_PUBLIC_FOCACCIA_TICKETS_URL",
  );
  const webOrigin = selectedOrigin(
    process.env.NEXT_PUBLIC_FOCACCIA_WEB_URL,
    DEFAULT_WEB_ORIGIN,
    "NEXT_PUBLIC_FOCACCIA_WEB_URL",
  );

  return {
    attendeeHref: ticketsOrigin,
    organizerHref: withPath(webOrigin, "/login"),
  };
}
