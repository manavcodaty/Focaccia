import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_PREFIXES = ["sb-", "supabase.auth."] as const;

function isAuthCookie(name: string): boolean {
  return AUTH_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  for (const { name } of request.cookies.getAll()) {
    if (!isAuthCookie(name)) {
      continue;
    }

    response.cookies.set({
      expires: new Date(0),
      maxAge: 0,
      name,
      path: "/",
      value: "",
    });
  }

  return response;
}
