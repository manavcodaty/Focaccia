import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";

const AUTH_ROUTES = ["/login"];
const PROTECTED_PREFIXES = ["/dashboard", "/events"];

function isPrivateIpv4Host(host: string): boolean {
  return /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const env = getPublicEnv();
  const resolvedUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL);

  if (
    request.nextUrl.hostname !== resolvedUrl.hostname
    && isPrivateIpv4Host(request.nextUrl.hostname)
    && isPrivateIpv4Host(resolvedUrl.hostname)
  ) {
    resolvedUrl.hostname = request.nextUrl.hostname;
  }

  const supabase = createServerClient(
    resolvedUrl.origin,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, options, value }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  const isAuthRoute = AUTH_ROUTES.some((route) => path.startsWith(route));

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
