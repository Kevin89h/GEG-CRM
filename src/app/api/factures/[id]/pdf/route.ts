import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient, getCompanySchema } from "@/lib/company"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { db } = await createCompanyClient()
  const { data: invoice } = await db.from("invoices").select("number").eq("id", id).single()
  const filename = invoice ? `Facture ${invoice.number}.pdf` : `facture-${id}.pdf`

  // Fetch doc settings for the PDF footer
  const publicSupa = await createClient()
  const schema = await getCompanySchema()
  const { data: company } = await publicSupa.from("companies").select("id").eq("schema_name", schema).single()
  const { data: ds } = company
    ? await publicSupa.from("document_settings").select("phone, email, website, nif, brand_color").eq("company_id", company.id).maybeSingle()
    : { data: null }

  const phone = (ds as Record<string, string> | null)?.phone ?? "+224 613 04 40 20"
  const website = (ds as Record<string, string> | null)?.website ?? "www.globalenergygroup.com"
  const nif = (ds as Record<string, string> | null)?.nif ?? "446243099"
  const color = (ds as Record<string, string> | null)?.brand_color ?? "#1e3a5f"

  const footerTemplate = `<div style="width:100%;background:${color};padding:9px 24px;display:flex;justify-content:center;align-items:center;gap:0;flex-wrap:wrap;font-family:Arial,Helvetica,sans-serif;font-size:9px;box-sizing:border-box;-webkit-print-color-adjust:exact;color-adjust:exact;">
    ${phone ? `<div style="display:flex;align-items:center;gap:5px;color:rgba(255,255,255,.9);padding:0 14px;">📞 <strong style="color:white">${phone}</strong></div>` : ""}
    ${phone && website ? `<div style="width:1px;height:16px;background:rgba(255,255,255,.25);flex-shrink:0;"></div>` : ""}
    ${website ? `<div style="display:flex;align-items:center;gap:5px;color:rgba(255,255,255,.9);padding:0 14px;">🌐 <strong style="color:white">${website}</strong></div>` : ""}
    ${website && nif ? `<div style="width:1px;height:16px;background:rgba(255,255,255,.25);flex-shrink:0;"></div>` : ""}
    ${nif ? `<div style="display:flex;align-items:center;gap:5px;color:rgba(255,255,255,.9);padding:0 14px;"><span style="opacity:.65;font-size:8px">NIF</span> <strong style="color:white">${nif}</strong></div>` : ""}
  </div>`

  const host = req.headers.get("host") ?? "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  const locale = req.nextUrl.searchParams.get("locale") ?? "fr"
  const url = `${protocol}://${host}/${locale}/ventes/factures/${id}/pdf`

  let browser
  try {
    const puppeteer = (await import("puppeteer-core")).default

    if (process.env.NODE_ENV === "production") {
      const chromium = (await import("@sparticuz/chromium-min")).default
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(
          "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
        ),
        headless: true,
      })
    } else {
      const executablePath =
        process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : "/usr/bin/google-chrome"
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })
    }

    const page = await browser.newPage()

    const cookieHeader = req.headers.get("cookie") ?? ""
    if (cookieHeader) {
      const domain = host.split(":")[0]
      const cookies = cookieHeader.split(";").flatMap(c => {
        const eqIdx = c.indexOf("=")
        if (eqIdx === -1) return []
        const name = c.slice(0, eqIdx).trim()
        const value = c.slice(eqIdx + 1).trim()
        return [{ name, value, domain }]
      })
      if (cookies.length) await page.setCookie(...cookies)
    }

    await page.emulateMediaType("print")
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })

    // Hide chat widget, nav overlays, and HTML footer bar (replaced by PDF native footer)
    // Add padding-bottom so last content never hides behind the footer margin
    await page.addStyleTag({ content: `
      [data-no-pdf], .no-print,
      nav, header:not(.doc-header),
      .crisp-client, #crisp-chatbox,
      .intercom-launcher, [class*="intercom"],
      #fc_widget, [id*="freshchat"],
      #hubspot-messages-iframe-container,
      .footer-bar { display: none !important; }
      .page { padding-bottom: 8px !important; }
    ` })

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate,
      margin: { top: "0", right: "0", bottom: "38px", left: "0" },
    })

    await browser.close()

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    if (browser) await browser.close().catch(() => {})
    console.error("PDF generation error:", err)
    return NextResponse.json({ error: "Erreur génération PDF" }, { status: 500 })
  }
}
