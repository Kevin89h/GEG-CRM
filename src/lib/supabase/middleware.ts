import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const COMPANY_COOKIE = "geg_company"

// Pages reachable without a session (or without a company)
const AUTH_PAGES = ["/login", "/forgot-password", "/reset-password", "/accept-invite"]
const NO_COMPANY_PAGE = "/aucune-societe"

// API routes a signed-in user may call even without any company (they don't touch company data)
const USER_LEVEL_API = ["/api/company/switch", "/api/profile", "/api/notifications", "/api/push/", "/api/auth/", "/api/users/"]

export async function updateSession(request: NextRequest, baseResponse?: ReturnType<typeof NextResponse.next>) {
  let supabaseResponse = baseResponse ?? NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isApi = pathname.startsWith("/api/")
  const locale = isApi ? "fr" : pathname.split("/")[1] || "fr"
  const isAuthPage = AUTH_PAGES.some(p => pathname.includes(p))
  const isNoCompanyPage = pathname.includes(NO_COMPANY_PAGE)

  if (!user) {
    if (isApi) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    if (isAuthPage) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    return NextResponse.redirect(url)
  }

  if (!isApi && pathname.includes("/login")) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/dashboard`
    return NextResponse.redirect(url)
  }

  // Companies the user is allowed on, from profiles.company_access (never from the cookie)
  const [{ data: profile }, { data: companies }] = await Promise.all([
    supabase.from("profiles").select("company_access").eq("id", user.id).single(),
    supabase.from("companies").select("id, schema_name").eq("is_active", true),
  ])
  const allowedIds = new Set<string>(profile?.company_access ?? [])
  const allowedSchemas = (companies ?? []).filter(c => allowedIds.has(c.id)).map(c => c.schema_name as string)

  if (allowedSchemas.length === 0) {
    if (isApi) {
      if (USER_LEVEL_API.some(p => pathname.startsWith(p))) return supabaseResponse
      return NextResponse.json({ error: "Aucune société attribuée" }, { status: 403 })
    }
    if (isNoCompanyPage || isAuthPage) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}${NO_COMPANY_PAGE}`
    return NextResponse.redirect(url)
  }

  if (isNoCompanyPage) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/dashboard`
    return NextResponse.redirect(url)
  }

  // The company cookie is only a preference: if it names a company the user can't access,
  // send back an allowed one (server code re-checks the cookie on every request anyway)
  const requested = request.cookies.get(COMPANY_COOKIE)?.value
  if (!requested || !allowedSchemas.includes(requested)) {
    supabaseResponse.cookies.set(COMPANY_COOKIE, allowedSchemas[0], {
      httpOnly: false,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return supabaseResponse
}
