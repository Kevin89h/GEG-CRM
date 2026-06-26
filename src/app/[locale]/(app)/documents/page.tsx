import { createCompanyClient } from "@/lib/company"
import DocumentsClient from "./DocumentsClient"

export default async function DocumentsPage() {
  const { db: supabase } = await createCompanyClient()

  const [{ data: documents }, { data: categories }, { data: accounts }] = await Promise.all([
    supabase
      .from("documents")
      .select(`id, name, description, file_url, file_name, file_size, file_type, created_at,
        category:document_categories(id, name, color),
        account:accounts(id, name)`)
      .order("created_at", { ascending: false }),
    supabase.from("document_categories").select("id, name, color").order("name"),
    supabase.from("accounts").select("id, name").order("name"),
  ])

  // Normalize Supabase join arrays to single objects
  const normalizedDocs = (documents ?? []).map((d: Record<string, unknown>) => ({
    ...d,
    category: Array.isArray(d.category) ? (d.category[0] ?? null) : d.category,
    account: Array.isArray(d.account) ? (d.account[0] ?? null) : d.account,
  }))

  return (
    <DocumentsClient
      documents={normalizedDocs as Parameters<typeof DocumentsClient>[0]["documents"]}
      categories={categories ?? []}
      accounts={accounts ?? []}
    />
  )
}
