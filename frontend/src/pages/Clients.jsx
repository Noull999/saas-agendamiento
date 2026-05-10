import { useEffect, useState, useRef } from 'react';
import api from '../api/client';

const EMPTY_FORM = { name: '', phone: '', email: '', notes: '' };

const STATUS_LABELS = {
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-600' },
  completed: { label: 'Completada', color: 'bg-slate-100 text-slate-600' },
  no_show: { label: 'No asistió', color: 'bg-amber-100 text-amber-700' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Clients() {
  const [data, setData] = useState({ patients: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal: nuevo/editar cliente
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal: historial de visitas
  const [historyClient, setHistoryClient] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const debounceRef = useRef(null);

  const load = async (q = search, page = 1) => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/patients', { params: { search: q || undefined, page, limit: 20 } });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(q, 1), 300);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', notes: c.notes || '' });
    setFormError('');
    setShowModal(true);
  };

  const openHistory = async (c) => {
    setHistoryClient(c);
    setHistoryLoading(true);
    try {
      const { data: res } = await api.get(`/patients/${c.id}/bookings`);
      setHistoryData(res.bookings || []);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('El nombre es requerido'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await api.put(`/patients/${editingId}`, form);
      } else {
        await api.post('/patients', form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{data.total} cliente{data.total !== 1 ? 's' : ''} registrado{data.total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openNew}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          + Nuevo cliente
        </button>
      </div>

      <div className="mb-4">
        <input
          value={search} onChange={handleSearch}
          placeholder="Buscar por nombre..."
          className="w-full max-w-sm border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {loading && <p className="text-slate-400 text-sm">Cargando...</p>}

      {!loading && data.patients.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <p className="text-4xl mb-3">✂️</p>
          <p className="text-slate-500 font-medium mb-1">Sin clientes registrados</p>
          <p className="text-slate-400 text-sm">Agrega clientes para llevar registro de sus preferencias y visitas</p>
        </div>
      )}

      {data.patients.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Preferencias</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Visitas</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Última visita</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.patients.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs">
                    {c.notes
                      ? <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{c.notes}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.booking_count > 0
                      ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                          {c.booking_count} {c.booking_count === 1 ? 'visita' : 'visitas'}
                        </span>
                      )
                      : <span className="text-slate-300 text-xs">Sin visitas</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(c.last_booking_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {c.booking_count > 0 && (
                        <button
                          onClick={() => openHistory(c)}
                          className="text-slate-500 hover:text-indigo-600 text-xs font-medium"
                        >
                          Historial
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(c)}
                        className="text-indigo-600 hover:underline text-xs font-medium"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.pages > 1 && (
        <div className="flex gap-2 mt-4">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
            <button
              key={p} onClick={() => load(search, p)}
              className={`px-3 py-1 rounded-lg text-sm ${data.page === p ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Modal: nuevo/editar cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{editingId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre completo *</label>
                <input
                  required value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  placeholder="Ej: María González"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Preferencias ✂️</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className={`${inputClass} resize-none`}
                  placeholder="Ej: Corte a tijeras, fade bajo, sin máquina en la parte de arriba..."
                />
              </div>
              {formError && <p className="text-red-600 text-xs">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={saving}
                  className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: historial de visitas */}
      {historyClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{historyClient.name}</h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  {historyClient.booking_count} visita{historyClient.booking_count !== 1 ? 's' : ''} en total
                  {historyClient.phone && <span className="ml-3 text-slate-400">· {historyClient.phone}</span>}
                </p>
                {historyClient.notes && (
                  <span className="inline-block mt-1.5 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    ✂️ {historyClient.notes}
                  </span>
                )}
              </div>
              <button
                onClick={() => setHistoryClient(null)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {historyLoading && <p className="text-slate-400 text-sm text-center py-8">Cargando historial...</p>}

            {!historyLoading && historyData.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-8">Sin visitas registradas</p>
            )}

            {!historyLoading && historyData.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {historyData.map(b => {
                  const st = STATUS_LABELS[b.status] || { label: b.status, color: 'bg-slate-100 text-slate-600' };
                  return (
                    <div key={b.id} className="flex items-start justify-between rounded-xl border border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{b.service_name || 'Servicio sin nombre'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(b.datetime_iso)}</p>
                        {b.professional_name && (
                          <p className="text-xs text-slate-400">con {b.professional_name}</p>
                        )}
                        {b.notes && <p className="text-xs text-slate-500 mt-1 italic">"{b.notes}"</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-3 ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setHistoryClient(null)}
                className="border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
