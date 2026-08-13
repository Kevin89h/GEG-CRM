import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatCurrency(value: number, currency: string) {
  const locales: Record<string, string> = { USD: "en-US", GNF: "fr-FR", EUR: "fr-FR", XOF: "fr-FR" }
  const noDecimals = ["GNF", "XOF"]
  return new Intl.NumberFormat(locales[currency] ?? "fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: noDecimals.includes(currency) ? 0 : 2,
  }).format(value)
}

export function formatDate(date: string, locale: string = "fr") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(date))
}

export function initials(name: string) {
  return name
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
