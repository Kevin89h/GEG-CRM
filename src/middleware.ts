import createMiddleware from "next-intl/middleware"
import { type NextRequest, NextResponse } from "next/server"
import { routing } from "@/i18n/routing"
import { updateSession } from "@/lib/supabase/middleware"

const intlMiddleware = createMiddleware(routing)

// API routes called without a user session; each one checks its own secret
const PUBLIC_API = ["/api/public/", "/api/cron/"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.some(p => pathname.startsWith(p))) return NextResponse.next()
    return await updateSession(request)
  }

  // Redirect legacy /accounts routes to /comptes
  const accountsMatch = pathname.match(/^(\/[a-z]{2})(\/accounts)(\/.*)?$/)
  if (accountsMatch) {
    const url = request.nextUrl.clone()
    url.pathname = `${accountsMatch[1]}/comptes${accountsMatch[3] ?? ""}`
    return NextResponse.redirect(url, { status: 301 })
  }

  const intlResponse = intlMiddleware(request)
  if (intlResponse.status !== 200) return intlResponse

  // Pass intlResponse as base so X-NEXT-INTL-LOCALE request header is preserved
  return await updateSession(request, intlResponse)
}

export const config = {
  matcher: ["/((?!_next|_vercel|pdf|.*\\..*).*)"],
}
