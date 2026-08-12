"use client"

export default function ComptesError({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
      <h2 className="text-lg font-bold text-red-800 mb-2">Erreur — comptes</h2>
      <pre className="text-sm text-red-700 whitespace-pre-wrap break-all">{error.message}</pre>
      {error.digest && <p className="text-xs text-red-500 mt-2">Digest: {error.digest}</p>}
    </div>
  )
}
