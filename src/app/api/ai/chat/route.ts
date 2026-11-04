import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createCompanyClient } from "@/lib/company"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_accounts",
    description: "Recherche un client ou fournisseur par nom dans la base de données",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Nom ou partie du nom du client/fournisseur" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_products",
    description: "Recherche un produit par nom dans le catalogue",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Nom ou partie du nom du produit" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_draft_devis",
    description: "Crée un devis en brouillon avec les lignes spécifiées",
    input_schema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "ID du client" },
        account_name: { type: "string", description: "Nom du client pour confirmation" },
        lines: {
          type: "array",
          description: "Lignes du devis",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string", description: "ID du produit (null si inconnu)" },
              description: { type: "string", description: "Description de la ligne" },
              quantity: { type: "number", description: "Quantité" },
              unit: { type: "string", description: "Unité (fût, litre, tonne, unité, etc.)" },
              unit_price: { type: "number", description: "Prix unitaire en GNF" },
            },
            required: ["description", "quantity", "unit_price"],
          },
        },
        currency: { type: "string", description: "Devise (GNF par défaut)", default: "GNF" },
        notes: { type: "string", description: "Notes ou conditions particulières" },
      },
      required: ["lines"],
    },
  },
  {
    name: "get_stats",
    description: "Récupère des statistiques du CRM (ventes, achats, stock, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["ventes", "achats", "stock", "clients", "factures"],
          description: "Type de statistiques à récupérer",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "list_pending_orders",
    description: "Liste les commandes ou devis en attente",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["devis", "achats", "factures"],
          description: "Type de document à lister",
        },
        limit: { type: "number", description: "Nombre maximum de résultats", default: 10 },
      },
      required: ["type"],
    },
  },
]

async function executeTool(name: string, input: Record<string, unknown>) {
  const { db } = await createCompanyClient()

  if (name === "search_accounts") {
    const q = (input.query as string).toLowerCase()
    const { data } = await db.from("accounts").select("id, name, type").ilike("name", `%${q}%`).limit(5)
    return data ?? []
  }

  if (name === "search_products") {
    const q = (input.query as string).toLowerCase()
    const { data } = await db.from("products").select("id, name, sell_price, currency, unit:units(name)").ilike("name", `%${q}%`).limit(5)
    return data ?? []
  }

  if (name === "create_draft_devis") {
    const lines = input.lines as Array<{
      product_id?: string
      description: string
      quantity: number
      unit?: string
      unit_price: number
    }>
    const total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)

    // Generate order number
    const { count } = await db.from("sales_orders").select("id", { count: "exact", head: true })
    const num = `DEV-${String((count ?? 0) + 1).padStart(4, "0")}`

    const { data: order, error } = await db
      .from("sales_orders")
      .insert({
        number: num,
        status: "draft",
        account_id: input.account_id || null,
        currency: (input.currency as string) ?? "GNF",
        notes: (input.notes as string) ?? null,
        total_ht: total,
      })
      .select()
      .single()

    if (error || !order) return { error: error?.message ?? "Erreur création devis" }

    // Insert lines
    if (lines.length > 0) {
      const orderLines = lines.map((l, i) => ({
        sales_order_id: order.id,
        product_id: l.product_id ?? null,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit ?? "unité",
        unit_price: l.unit_price,
        total: l.quantity * l.unit_price,
        position: i + 1,
      }))
      await db.from("sales_order_lines").insert(orderLines)
    }

    return {
      success: true,
      id: order.id,
      number: num,
      client: input.account_name ?? "Non spécifié",
      total,
      currency: input.currency ?? "GNF",
      lines_count: lines.length,
      url: `/fr/ventes/devis/${order.id}`,

    }
  }

  if (name === "get_stats") {
    const type = input.type as string

    if (type === "ventes") {
      const { data } = await db.from("sales_order_totals").select("status, total_ht, currency")
      const confirmed = data?.filter(o => o.status === "confirmed") ?? []
      const total = confirmed.reduce((s, o) => s + Number(o.total_ht), 0)
      return {
        total_devis: data?.length ?? 0,
        commandes_confirmees: confirmed.length,
        ca_total_gnf: total,
        brouillons: data?.filter(o => o.status === "draft").length ?? 0,
      }
    }

    if (type === "achats") {
      const { data } = await db.from("purchase_orders").select("status, total")
      const confirmed = data?.filter(o => o.status === "confirmed" || o.status === "received") ?? []
      return {
        total_commandes: data?.length ?? 0,
        confirmees: confirmed.length,
        en_attente: data?.filter(o => o.status === "draft" || o.status === "sent").length ?? 0,
      }
    }

    if (type === "stock") {
      const { data } = await db.from("stock_levels").select("product_id, quantity, warehouse_id")
      return {
        total_references: new Set(data?.map(s => s.product_id)).size,
        total_mouvements: data?.length ?? 0,
      }
    }

    if (type === "clients") {
      const { data } = await db.from("accounts").select("id, type").eq("type", "client")
      return { total_clients: data?.length ?? 0 }
    }

    if (type === "factures") {
      const { data } = await db.from("invoice_totals").select("status, balance, currency")
      const ouvertes = data?.filter(f => f.status === "open") ?? []
      const aEncaisser = ouvertes.reduce((s, f) => s + Number(f.balance), 0)
      return {
        total_factures: data?.length ?? 0,
        ouvertes: ouvertes.length,
        payees: data?.filter(f => f.status === "paid").length ?? 0,
        a_encaisser_gnf: aEncaisser,
      }
    }

    return {}
  }

  if (name === "list_pending_orders") {
    const type = input.type as string
    const limit = (input.limit as number) ?? 10

    if (type === "devis") {
      const { data } = await db
        .from("sales_order_totals")
        .select("id, number, status, total_ht, currency, account_id, created_at")
        .in("status", ["draft", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(limit)
      return data ?? []
    }

    if (type === "achats") {
      const { data } = await db
        .from("purchase_orders")
        .select("id, reference, status, total, currency, supplier_id, order_date")
        .in("status", ["draft", "sent"])
        .order("order_date", { ascending: false })
        .limit(limit)
      return data ?? []
    }

    if (type === "factures") {
      const { data } = await db
        .from("invoice_totals")
        .select("id, number, status, balance, currency, account_id, due_date")
        .eq("status", "open")
        .order("due_date", { ascending: true })
        .limit(limit)
      return data ?? []
    }

    return []
  }

  return { error: "Outil inconnu" }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    const systemPrompt = `Tu es l'assistant IA du CRM GEG Guinée. Tu aides l'équipe commerciale et logistique de Global Energy Group en Guinée.

Tes capacités :
- Créer des devis (brouillons) à partir de demandes en langage naturel
- Rechercher des clients et produits dans la base de données
- Donner des statistiques sur les ventes, achats, stock, factures
- Répondre à des questions sur l'activité

Règles importantes :
- La devise principale est le GNF (Franc Guinéen). "7M" = 7 000 000 GNF, "500K" = 500 000 GNF
- Un "fût" de lubrifiant = 208 litres standard
- Toujours confirmer les détails avant de créer un document
- Si le client n'est pas dans la base, créer le devis sans account_id et le mentionner
- Réponds en français, de façon concise et professionnelle
- Quand tu crées un devis, donne le numéro et un lien direct

Pour créer un devis :
1. Extraire client, produits, quantités, prix du message
2. Rechercher le client avec search_accounts si mentionné
3. Rechercher les produits si nécessaire
4. Appeler create_draft_devis avec toutes les informations`

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    })

    // Handle tool use in an agentic loop
    let currentResponse = response
    const allMessages = [...messages]

    while (currentResponse.stop_reason === "tool_use") {
      const toolUseBlocks = currentResponse.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      )

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      allMessages.push({ role: "assistant", content: currentResponse.content })
      allMessages.push({ role: "user", content: toolResults })

      currentResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages: allMessages,
      })
    }

    const textBlock = currentResponse.content.find((b): b is Anthropic.TextBlock => b.type === "text")

    return NextResponse.json({
      reply: textBlock?.text ?? "Désolé, je n'ai pas pu traiter ta demande.",
      usage: currentResponse.usage,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("AI chat error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
