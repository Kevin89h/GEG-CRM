export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
      <img src="/geg-logo.png" alt="GEG" className="w-16 h-16 opacity-80" />
      <h1 className="text-xl font-semibold">Pas de connexion</h1>
      <p className="text-slate-400 text-sm">Vérifiez votre connexion internet et réessayez.</p>
    </div>
  )
}
