import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "GEG CRM",
  description: "Customer Relationship Management — Global Energy Group",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${inter.variable} h-full antialiased`} style={{ colorScheme: "light" }}>
      <body className="h-full bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
