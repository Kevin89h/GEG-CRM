import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const NOTIFY_RECIPIENTS = ["nils@globalenergy.group", "kevin@globalenergy.group"]

interface LeadNotificationParams {
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
  if (!process.env.RESEND_API_KEY) return

  const crmLabel = params.company === "geg_singapore" ? "GEG Singapore" : "GEG Guinée"
  const crmUrl = "https://geg-crm.vercel.app"

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">🔔 Nouveau lead — ${crmLabel}</h2>
      </div>
      <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #666; width: 140px;">Nom</td><td style="padding: 8px 0; font-weight: bold;">${params.name}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;"><a href="mailto:${params.email}" style="color: #2563eb;">${params.email}</a></td></tr>
          ${params.phone ? `<tr><td style="padding: 8px 0; color: #666;">Téléphone</td><td style="padding: 8px 0;"><a href="https://wa.me/${params.phone.replace(/\D/g, "")}" style="color: #16a34a;">${params.phone}</a></td></tr>` : ""}
          ${params.country ? `<tr><td style="padding: 8px 0; color: #666;">Pays</td><td style="padding: 8px 0;">${params.country}</td></tr>` : ""}
          <tr><td style="padding: 8px 0; color: #666;">Source</td><td style="padding: 8px 0;">${params.source}</td></tr>
          ${params.message ? `<tr><td style="padding: 8px 0; color: #666; vertical-align: top;">Message</td><td style="padding: 8px 0; white-space: pre-wrap;">${params.message}</td></tr>` : ""}
        </table>
        <div style="margin-top: 20px;">
          <a href="${crmUrl}" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Voir dans le CRM →</a>
        </div>
      </div>
    </div>
  `

  await resend.emails.send({
    from: "GEG CRM <noreply@globalenergy.group>",
    to: NOTIFY_RECIPIENTS,
    subject: `Nouveau lead : ${params.dealTitle}`,
    html,
  })
}
