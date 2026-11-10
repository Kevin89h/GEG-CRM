import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { accessDeniedPath, deniedForPath } from "@/lib/navigation"
import { allows, apiPermissions } from "@/lib/permissions"

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

  // Companies the user is allowed on, from profiles.company_access (never from the cookie)
  const [{ data: profile }, { data: companies }] = await Promise.all([
    supabase.from("profiles").select("role, company_access, is_blocked").eq("id", user.id).single(),
    supabase.from("companies").select("id, schema_name").eq("is_active", true),
  ])

  // Blocked account: refused at once, even with a session still open
  if (profile?.is_blocked) {
    if (isApi) return NextResponse.json({ error: "Compte bloqué" }, { status: 403 })
    if (isAuthPage) return supabaseResponse
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    url.search = "?bloque=1"
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c))
    return res
  }

  if (!isApi && pathname.includes("/login")) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/dashboard`
    return NextResponse.redirect(url)
  }

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

  // Active company and effective permissions in it (role standard + personal exceptions of that company)
  const requested = request.cookies.get(COMPANY_COOKIE)?.value
  const schema = requested && allowedSchemas.includes(requested) ? requested : allowedSchemas[0]
  const { data: permData } = await supabase.rpc("my_permissions", { p_schema: schema })
  const perms = (permData as string[] | null) ?? []

  // API calls: the route and method need one of their permissions in the active company
  if (isApi) {
    const keys = apiPermissions(pathname, request.method)
    if (keys && !allows(perms, keys)) {
      await supabase.rpc("audit_refusal", { p_company: schema, p_module: "api", p_target: `${request.method} ${pathname}`, p_reason: `Permission manquante : ${keys.join(" ou ")}` })
      return NextResponse.json({ error: "Vos permissions ne permettent pas cette action", permission: keys[0] }, { status: 403 })
    }
  }

  // Pages the user can't open lead to the "access denied" page (the menu shows them with a lock)
  if (!isApi && !isAuthPage) {
    const path = pathname.split("/").slice(2).join("/")
    const denial = deniedForPath(path, { role: profile?.role, schemas: allowedSchemas, perms, activeSchema: schema })
    if (denial) {
      await supabase.rpc("audit_refusal", { p_company: schema, p_module: "page", p_target: path, p_reason: denial.permission ? `Permission manquante : ${denial.permission}` : "Accès non autorisé" })
      const url = request.nextUrl.clone()
      const target = new URL(accessDeniedPath(locale, denial.key, denial.permission), request.nextUrl.origin)
      url.pathname = target.pathname
      url.search = target.search
      return NextResponse.redirect(url)
    }
  }

  // The company cookie is only a preference: if it names a company the user can't access,
  // send back an allowed one (server code re-checks the cookie on every request anyway)
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
