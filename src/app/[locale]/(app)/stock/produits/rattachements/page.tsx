import { hasPermission, requireSchemaPage } from "@/lib/access"
import RattachementsClient from "./RattachementsClient"

// Historical correspondence: old FREE lines of quotes and invoices linked to catalogue fiches.
// Opening the page needs "produits.voir" (page rule "stock/produits/rattachements"); the lines are loaded
// by /api/produits/rattachements, which also filters invoice / quote lines by "factures.voir" / "devis.voir".
// Linking, validating and cancelling need "produits.gerer" (checked again by the server).
export default async function RattachementsPage() {
  await requireSchemaPage("geg_guinee")
  const canManage = await hasPermission("produits.gerer")
  return <RattachementsClient canManageInitial={canManage} />
}
