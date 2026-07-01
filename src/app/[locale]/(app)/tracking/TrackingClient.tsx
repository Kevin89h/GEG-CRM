'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'in_transit' | 'arrived' | 'delayed' | 'delivered';
type ShipmentType = 'container' | 'parcel';

interface Shipment {
  id: string;
  type: ShipmentType;
  carrier: string;
  tracking_number: string;
  description: string | null;
  status: Status;
  eta: string | null;
  origin: string | null;
  destination: string | null;
  notes: string | null;
  created_at: string;
}

interface LiveEvent {
  date: string;
  location: string;
  description: string;
}

interface LiveData {
  status: string;
  lastLocation: string;
  lastDate: string;
  events: LiveEvent[];
  eta: string | null;
}

const LIVE_CARRIERS = ['MSC', 'CMA CGM'];
const CONTAINER_CARRIERS = ['MSC', 'CMA CGM', 'Hapag-Lloyd', 'Maersk'];
const PARCEL_CARRIERS = ['DHL', 'FedEx'];

const STATUS_LABELS: Record<Status, string> = {
  in_transit: 'En transit',
  arrived: 'Arrivé',
  delayed: 'Retardé',
  delivered: 'Livré',
};

const STATUS_COLORS: Record<Status, string> = {
  in_transit: 'bg-blue-100 text-blue-700',
  arrived: 'bg-green-100 text-green-700',
  delayed: 'bg-orange-100 text-orange-700',
  delivered: 'bg-slate-100 text-slate-600',
};

function trackingUrl(carrier: string, number: string): string {
  const n = encodeURIComponent(number);
  switch (carrier) {
    case 'MSC': return `https://www.msc.com/en/track-a-shipment?agencyPath=msc&numbers=${n}`;
    case 'CMA CGM': return `https://www.cma-cgm.com/ebusiness/tracking/search?numero=${n}`;
    case 'Hapag-Lloyd': return `https://www.hapag-lloyd.com/en/online-business/tracing/tracing-by-container.html?container=${n}`;
    case 'Maersk': return `https://www.maersk.com/tracking/${n}`;
    case 'DHL': return `https://www.dhl.com/fr-fr/home/tracking/tracking-parcel.html?submit=1&tracking-id=${n}`;
    case 'FedEx': return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    default: return '#';
  }
}

const BLANK_FORM = {
  type: 'container' as ShipmentType,
  carrier: 'MSC',
  tracking_number: '',
  description: '',
  origin: '',
  destination: '',
  eta: '',
  status: 'in_transit' as Status,
  notes: '',
};

export default function TrackingClient({ shipments: initial }: { shipments: Shipment[], schema: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<ShipmentType>('container');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [liveData, setLiveData] = useState<Record<string, LiveData | 'loading' | 'error'>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = initial.filter((s) => s.type === tab);
  const carriers = tab === 'container' ? CONTAINER_CARRIERS : PARCEL_CARRIERS;

  function handleTypeChange(type: ShipmentType) {
    setForm((f) => ({ ...f, type, carrier: type === 'container' ? 'MSC' : 'DHL' }));
  }

  async function fetchLive(shipment: Shipment) {
    if (!LIVE_CARRIERS.includes(shipment.carrier)) return;
    setLiveData(prev => ({ ...prev, [shipment.id]: 'loading' }));
    setExpandedId(shipment.id);
    try {
      const res = await fetch(
        `/api/tracking?carrier=${encodeURIComponent(shipment.carrier)}&number=${encodeURIComponent(shipment.tracking_number)}`
      );
      const json = await res.json();
      if (json.parsed) {
        setLiveData(prev => ({ ...prev, [shipment.id]: json.parsed }));
      } else if (json.trackingUrl) {
        // API not accessible — open direct link
        window.open(json.trackingUrl, '_blank');
        setLiveData(prev => ({ ...prev, [shipment.id]: 'error' }));
      } else {
        setLiveData(prev => ({ ...prev, [shipment.id]: 'error' }));
      }
    } catch {
      setLiveData(prev => ({ ...prev, [shipment.id]: 'error' }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.error ?? 'Erreur lors de l\'enregistrement');
        return;
      }
      setModalOpen(false);
      setForm(BLANK_FORM);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/shipments?id=${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Suivi des expéditions</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Ajouter
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(['container', 'parcel'] as ShipmentType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'container' ? 'Conteneurs maritimes' : 'Colis'}
          </button>
        ))}
      </div>

      {/* Shipments list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">Aucune expédition enregistrée.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Transporteur</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">N° de suivi</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Description</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Origine → Destination</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">ETA</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const live = liveData[s.id];
                const isExpanded = expandedId === s.id;
                return (
                  <>
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.carrier}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{s.tracking_number}</td>
                      <td className="px-4 py-3 text-slate-600">{s.description ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.origin || s.destination
                          ? `${s.origin ?? '?'} → ${s.destination ?? '?'}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {live && live !== 'loading' && live !== 'error' && live.eta
                          ? <span className="text-blue-600 font-medium">{live.eta}</span>
                          : (s.eta ?? '—')}
                      </td>
                      <td className="px-4 py-3">
                        {live && live !== 'loading' && live !== 'error' ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {live.status}
                          </span>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                            {STATUS_LABELS[s.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {LIVE_CARRIERS.includes(s.carrier) && (
                            <button
                              onClick={() => isExpanded ? setExpandedId(null) : fetchLive(s)}
                              className="text-emerald-600 hover:text-emerald-700 text-xs font-medium transition-colors"
                            >
                              {live === 'loading' ? '…' : isExpanded ? 'Fermer' : '↻ Live'}
                            </button>
                          )}
                          <a
                            href={trackingUrl(s.carrier, s.tracking_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs font-medium"
                          >
                            Site
                          </a>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-slate-400 hover:text-red-500 text-xs transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Live events panel */}
                    {isExpanded && (
                      <tr key={`${s.id}-live`}>
                        <td colSpan={7} className="px-4 py-0 bg-slate-50 border-b border-slate-200">
                          {live === 'loading' && (
                            <div className="py-4 text-sm text-slate-500">Récupération en cours…</div>
                          )}
                          {live === 'error' && (
                            <div className="py-4 text-sm text-red-500">
                              Impossible de récupérer le tracking live. Vérifiez le numéro ou utilisez le lien "Site".
                            </div>
                          )}
                          {live && live !== 'loading' && live !== 'error' && (
                            <div className="py-3">
                              <div className="flex items-center gap-4 mb-3">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dernière position</span>
                                <span className="text-sm font-medium text-slate-800">{live.lastLocation || '—'}</span>
                                <span className="text-xs text-slate-400">{live.lastDate}</span>
                              </div>
                              {live.events.length > 0 && (
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {live.events.map((ev, i) => (
                                    <div key={i} className="flex gap-3 text-xs text-slate-600 py-1 border-b border-slate-100 last:border-0">
                                      <span className="text-slate-400 shrink-0 w-32">{ev.date}</span>
                                      <span className="text-slate-500 shrink-0 w-28 truncate">{ev.location}</span>
                                      <span>{ev.description}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Marine traffic map — containers only */}
      {tab === 'container' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Carte des navires</h2>
          </div>
          <iframe
            src="https://www.marinetraffic.com/en/ais/embed/maptype:1/zoom:3"
            className="w-full"
            style={{ height: 420, border: 'none' }}
            title="Carte des navires MarineTraffic"
            loading="lazy"
          />
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Ajouter une expédition</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => handleTypeChange(e.target.value as ShipmentType)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="container">Conteneur maritime</option>
                    <option value="parcel">Colis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Transporteur</label>
                  <select
                    value={form.carrier}
                    onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                  >
                    {carriers.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">N° de suivi *</label>
                <input
                  required
                  value={form.tracking_number}
                  onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                  placeholder="ex: MSCU1234567 ou MSCUXXXXXXX"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                  placeholder="ex: Équipements miniers"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Origine</label>
                  <input
                    value={form.origin}
                    onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                    placeholder="ex: Shanghai"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Destination</label>
                  <input
                    value={form.destination}
                    onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                    placeholder="ex: Conakry"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ETA</label>
                  <input
                    type="date"
                    value={form.eta}
                    onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Statut</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                  >
                    {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
