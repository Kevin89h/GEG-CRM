import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export type ActivityAction = "create" | "update" | "delete" | "login" | "view" | "export" | "send" | "cancel" | "payment"
export type ActivityResource =
  | "invoice" | "devis" | "achat" | "payment"
  | "deal" | "contact" | "account" | "activity"
  | "product" | "warehouse" | "stock_movement"
  | "employee" | "document" | "user" | "settings"

interface LogOptions {
  action: ActivityAction
  resource: ActivityResource
  resourceId?: string
  label: string
  details?: Record<string, unknown>
}

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function logActivity(opts: LogOptions): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const admin = getAdminClient()

    let userName: string | null = null
    if (user) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single()
      userName = profile?.full_name ?? profile?.email ?? null
    }

    await admin
      .schema("geg_guinee")
      .from("activity_logs")
      .insert({
        user_id:     user?.id ?? null,
        user_email:  user?.email ?? null,
        user_name:   userName,
        action:      opts.action,
        resource:    opts.resource,
        resource_id: opts.resourceId ?? null,
        label:       opts.label,
        details:     opts.details ?? null,
      })
  } catch {
    // Never crash the main request because of logging
  }
}

export async function logLogin(userId: string, email: string): Promise<void> {
  try {
    const admin = getAdminClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single()

    await admin
      .schema("geg_guinee")
      .from("activity_logs")
      .insert({
        user_id:    userId,
        user_email: email,
        user_name:  profile?.full_name ?? email,
        action:     "login",
        resource:   "user",
        label:      `Connexion de ${profile?.full_name ?? email}`,
      })
  } catch {
    // Never crash
  }
}
