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

export function formatCurrency(value: number, currency: "USD" | "GNF" | "EUR") {
  const locales: Record<string, string> = { USD: "en-US", GNF: "fr-FR", EUR: "fr-FR" }
  return new Intl.NumberFormat(locales[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "GNF" ? 0 : 2,
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
