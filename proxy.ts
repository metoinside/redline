import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readSupabaseEnv } from "@/lib/supabase/config";

// Keeps the Supabase session fresh: reads the auth cookies, refreshes the
// token when it has expired, and writes the new cookies to both the request
// (for the page about to render) and the response (for the browser).
// Pages decide who may see what; this file only refreshes. With accounts not
// set up it does nothing.
export async function proxy(request: NextRequest) {
  const env = readSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Do not put code between creating the client and this call.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Everything except static assets and the public landing page.
  matcher: ["/((?!_next/static|_next/image|fonts/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).+)"],
};
