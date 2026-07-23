import { createCompanyClient } from "@/lib/company"
import ClientsContactsClient from "./ClientsContactsClient"

export default async function ClientsContactsPage() {
  const { db } = await createCompanyClient()
  const { data } = await db
    .from("accounts")
    .select("id, name, email, phone, city, country, type")
    .order("name")
  return <ClientsContactsClient clients={data ?? []} />
}
