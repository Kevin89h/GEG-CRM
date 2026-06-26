import { createCompanyClient } from "@/lib/company"
import ContactsClient from "./ContactsClient"

export default async function ContactsPage() {
  const { db: supabase } = await createCompanyClient()

  const [{ data: contacts }, { data: accounts }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*, account:accounts(id, name, type)")
      .order("last_name"),
    supabase
      .from("accounts")
      .select("id, name")
      .order("name"),
  ])

  return <ContactsClient contacts={contacts ?? []} accounts={accounts ?? []} />
}
