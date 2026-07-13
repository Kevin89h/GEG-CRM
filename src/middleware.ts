import createMiddleware from "next-intl/middleware"
import { type NextRequest, NextResponse } from "next/server"
import { routing } from "@/i18n/routing"
import { updateSession } from "@/lib/supabase/middleware"

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request)
  if (intlResponse.status !== 200) return intlResponse

  // Pass intlResponse as base so X-NEXT-INTL-LOCALE request header is preserved
  return await updateSession(request, intlResponse)
}

export const config = {
  matcher: ["/((?!_next|_vercel|api|.*\\..*).*)"],
}
