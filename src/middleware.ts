import createMiddleware from "next-intl/middleware"
import { type NextRequest, NextResponse } from "next/server"
import { routing } from "@/i18n/routing"
import { updateSession } from "@/lib/supabase/middleware"

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
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
  matcher: ["/((?!_next|_vercel|api|pdf|.*\\..*).*)"],
}
