import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import SwRegister from "@/components/SwRegister"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "GEG CRM",
  description: "Customer Relationship Management — Global Energy Group",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GEG CRM",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "GEG CRM",
    description: "Customer Relationship Management — Global Energy Group",
    url: "https://crm.gegoil.com",
    siteName: "GEG CRM",
    images: [
      {
        url: "https://crm.gegoil.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "GEG CRM",
      },
    ],
    type: "website",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${inter.variable} h-full antialiased`} style={{ colorScheme: "light" }}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className="h-full bg-gray-50 text-gray-900">
        {children}
        <SwRegister />
      </body>
    </html>
  )
}
