type Row = Record<string, string | number | boolean | null | undefined>

export function exportToXls(rows: Row[], filename: string) {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])

  // BOM for Excel UTF-8 support
  const bom = "﻿"
  const sep = ";"

  const escape = (v: string | number | boolean | null | undefined): string => {
    if (v === null || v === undefined) return ""
    const s = String(v)
    // Wrap in quotes if contains sep, newline or quote
    if (s.includes(sep) || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const lines = [
    headers.map(escape).join(sep),
    ...rows.map(row => headers.map(h => escape(row[h])).join(sep)),
  ]

  const csv = bom + lines.join("\r\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
