// Identity of a catalogue sheet (A4, A6, M5 — GEG 24/11/2026). Server only.
// One sheet = one product / brand / reference / packaging / unit / type. 20 L and 200 L are two sheets.
// - packaging: a closed list, mandatory for physical goods; « Autre » needs a free text and the validation of a
//   Manager (or above) before the sheet can be used on a document;
// - a TRUE duplicate (same type, designation, brand, packaging and unit) is refused, on creation AND modification;
//   distinct articles (another brand, packaging, unit or type) are allowed. Nothing is ever merged automatically.
/** Lower case, accents removed, « 15 W-40 » → 15w40, « 20 L » → 20l (same rule as the catalogue search of Dev) */
export function normalize(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/(\d)\s*[- ]?\s*w\s*[- ]?\s*(\d)/g, "$1w$2")
    .replace(/(\d+(?:[.,]\d+)?)\s*(l|kg|ml|litres?)\b/g, (_, n, u) => `${n.replace(",", ".")}${u.startsWith("lit") ? "l" : u}`)
    .replace(/[^a-z0-9.+/]+/g, " ").trim()
}
/** Packaging written in a designation (« 20l », « 200l »), null when none */
function packagingInText(s: string | null | undefined): string | null {
  return normalize(s).match(/\b\d+(?:\.\d+)?(?:l|kg|ml)\b/)?.[0] ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export const PACKAGINGS = ["1 L", "4 L", "5 L", "20 L", "200 L", "208 L", "Autre"] as const
export const PRODUCT_TYPES = ["storable", "consumable", "service", "discount"] as const
export const PHYSICAL_TYPES = ["storable", "consumable"]
// production role model: admin / manager / sales_rep (super_admin kept for the general deployment)
export const MANAGER_ROLES = ["manager", "admin", "super_admin"]

export interface SheetIdentity {
  name: string
  product_type: string
  brand?: string | null
  packaging?: string | null
  packaging_other?: string | null
  unit_id?: string | null
  reference?: string | null
}

/** French error when the packaging fields are not valid for this type, null when they are */
export function packagingError(s: SheetIdentity): string | null {
  if (!PHYSICAL_TYPES.includes(s.product_type)) {
    return s.packaging ? "Un conditionnement ne s'applique qu'à une marchandise (pas à une prestation ni à une remise)" : null
  }
  if (!s.packaging) return "Conditionnement obligatoire pour une marchandise : choisissez 1 L, 4 L, 5 L, 20 L, 200 L, 208 L ou Autre"
  if (!(PACKAGINGS as readonly string[]).includes(s.packaging)) return "Conditionnement inconnu : choisissez dans la liste"
  if (s.packaging === "Autre" && !(s.packaging_other ?? "").trim()) return "Conditionnement « Autre » : précisez-le (champ obligatoire)"
  return null
}

/** Effective packaging (free text for « Autre »), normalised; an older sheet without the field: read from its designation */
const packKey = (s: SheetIdentity) => s.packaging
  ? normalize(s.packaging === "Autre" ? s.packaging_other : s.packaging).replace(/\s+/g, "")
  : (packagingInText(s.name) ?? "")

/** The existing sheet that is a true duplicate of this identity, or null (excludeId: the sheet being modified) */
export async function findDuplicate(db: Db, s: SheetIdentity, excludeId?: string): Promise<{ id: string; label: string } | null> {
  const name = normalize(s.name)
  if (!name) return null
  const { data } = await db.from("products").select("id, name, product_type, brand, packaging, packaging_other, unit_id, product_code").limit(20000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = ((data ?? []) as any[]).find(p => p.id !== excludeId
    && normalize(p.name) === name
    && (p.product_type ?? "storable") === s.product_type
    && normalize(p.brand) === normalize(s.brand)
    && packKey(p) === packKey(s)
    // an unknown unit (older sheet) is not a difference: compared only when both sheets have one
    && (!p.unit_id || !s.unit_id || p.unit_id === s.unit_id))
  return hit ? { id: hit.id, label: `${hit.product_code ? hit.product_code + " " : ""}${hit.name}` } : null
}

export function duplicateMessage(d: { label: string }) {
  return `Doublon refusé : la fiche « ${d.label} » a déjà la même désignation, la même marque, le même conditionnement, la même unité et le même type. ` +
    "Utilisez cette fiche, ou modifiez ce qui distingue réellement le nouvel article (marque, conditionnement, unité ou type)."
}
