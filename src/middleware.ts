import createMiddleware from "next-intl/middleware"
import { type NextRequest, NextResponse } from "next/server"
import { routing } from "@/i18n/routing"
import { updateSession } from "@/lib/supabase/middleware"
import { createServerClient } from "@supabase/ssr"

const intlMiddleware = createMiddleware(routing)

const API_PUBLIC_PREFIXES = ["/api/public/", "/api/cron/"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirect legacy /accounts routes to /comptes
  const accountsMatch = pathname.match(/^(\/[a-z]{2})(\/accounts)(\/.*)?$/)
  if (accountsMatch) {
    const url = request.nextUrl.clone()
    url.pathname = `${accountsMatch[1]}/comptes${accountsMatch[3] ?? ""}`
    return NextResponse.redirect(url, { status: 301 })
  }

  // Auth guard for API routes
  if (pathname.startsWith("/api/")) {
    const isPublic = API_PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
    if (!isPublic) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: () => {},
          },
        }
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    return NextResponse.next()
  }

  const intlResponse = intlMiddleware(request)
  if (intlResponse.status !== 200) return intlResponse

  // Pass intlResponse as base so X-NEXT-INTL-LOCALE request header is preserved
  return await updateSession(request, intlResponse)
}

export const config = {
  matcher: ["/((?!_next|_vercel|pdf|.*\\..*).*)"],
}
