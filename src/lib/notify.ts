const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/wmen54zsoxna1f6srqrguayoey0bn2q6"

export interface LeadNotificationParams {
  name: string
  email: string
  phone?: string | null
  country?: string | null
  message?: string | null
  dealTitle: string
  company: "geg_singapore" | "geg_guinee"
  source: string
}

export async function sendLeadNotification(params: LeadNotificationParams) {
  await fetch(MAKE_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      phone: params.phone ?? "",
      country: params.country ?? "",
      message: params.message ?? "",
      deal_title: params.dealTitle,
      company: params.company === "geg_singapore" ? "GEG Singapore" : "GEG Guinée",
      source: params.source,
    }),
  })
}
