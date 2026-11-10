import { hasPermission } from "@/lib/access"
import { getCompanyName, getCompanySchema } from "@/lib/company"
import RattachementsClient from "./RattachementsClient"

// Historical correspondence: old FREE lines of quotes and invoices linked to catalogue fiches, in the ACTIVE company.
// Opening the page needs "produits.voir" (page rule "stock/produits/rattachements"); the lines are loaded
// by /api/produits/rattachements, which also filters invoice / quote lines by "factures.voir" / "devis.voir".
// Linking, validating and cancelling need "produits.gerer" (checked again by the server).
export default async function RattachementsPage() {
  const schema = await getCompanySchema()
  const [canManage, companyName] = await Promise.all([hasPermission("produits.gerer"), getCompanyName(schema)])
  return <RattachementsClient canManageInitial={canManage} companyName={companyName} />
}
