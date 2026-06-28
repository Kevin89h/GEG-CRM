import { createCompanyClient } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"
import DocumentsClient from "./DocumentsClient"

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null }

  const userRole: string = profile?.role ?? "member"
  const isAdmin = userRole === "admin"

  const { db } = await createCompanyClient()

  // Build visibility filter: admin sees all; others see 'all' + their role
  let visibilityFilter: string[]
  if (isAdmin) {
    visibilityFilter = ["all", "admin", "finance", "management"]
  } else if (userRole === "finance") {
    visibilityFilter = ["all", "finance"]
  } else if (userRole === "management" || userRole === "manager") {
    visibilityFilter = ["all", "management"]
  } else {
    visibilityFilter = ["all"]
  }

  const [{ data: documents }, { data: categories }, { data: accounts }] = await Promise.all([
    db
      .from("documents")
      .select(`id, name, description, file_url, file_name, file_size, file_type, created_at,
        visibility, is_company_doc, doc_type,
        category:document_categories(id, name, color),
        account:accounts(id, name)`)
      .in("visibility", visibilityFilter)
      .order("created_at", { ascending: false }),
    db.from("document_categories").select("id, name, color").order("name"),
    db.from("accounts").select("id, name").order("name"),
  ])

  const normalizedDocs = (documents ?? []).map((d: Record<string, unknown>) => ({
    ...d,
    visibility: (d.visibility as string) ?? "all",
    is_company_doc: Boolean(d.is_company_doc),
    category: Array.isArray(d.category) ? (d.category[0] ?? null) : d.category,
    account:  Array.isArray(d.account)  ? (d.account[0]  ?? null) : d.account,
  }))

  return (
    <DocumentsClient
      documents={normalizedDocs as Parameters<typeof DocumentsClient>[0]["documents"]}
      categories={categories ?? []}
      accounts={accounts ?? []}
      userRole={userRole}
      isAdmin={isAdmin}
    />
  )
}
