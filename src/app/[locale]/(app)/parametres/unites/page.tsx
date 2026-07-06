import { createCompanyClient } from "@/lib/company"
import UnitesClient from "./UnitesClient"

export default async function UnitesPage() {
  const { db } = await createCompanyClient()
  const { data: units } = await db.from("units").select("*").order("name")
  return <UnitesClient units={units ?? []} />
}
