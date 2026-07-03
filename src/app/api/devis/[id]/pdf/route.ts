import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"

export const maxDuration = 60

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Fetch doc number for filename
  const { db } = await createCompanyClient()
  const { data: order } = await db.from("sales_orders").select("number, status").eq("id", id).single()
  const docLabel = (order as Record<string,unknown>)?.status === "confirmed" ? "BC" : "DEVIS"
  const filename = order ? `${docLabel} - ${order.number}.pdf` : `devis-${id}.pdf`

  const host = req.headers.get("host") ?? "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  const locale = req.nextUrl.searchParams.get("locale") ?? "fr"
  const url = `${protocol}://${host}/${locale}/ventes/devis/${id}/pdf`

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
      // Dev: use local Chrome
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

    // Forward auth cookies so the page loads authenticated
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

    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 })

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })

    await browser.close()

    return new NextResponse(pdf, {
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
