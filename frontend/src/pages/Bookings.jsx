import { useEffect, useState } from 'react';
import api from '../api/client';

const STATUS_LABELS = {
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-600' },
  completed: { label: 'Completada', color: 'bg-slate-100 text-slate-600' },
  no_show: { label: 'No asistió', color: 'bg-amber-100 text-amber-700' },
};

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bookings', { params: { date } });
      setBookings(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date]);

  const changeStatus = async (id, status) => {
    await api.patch(`/bookings/${id}/status`, { status });
    load();
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const pending = bookings.filter(b => b.status === 'pending').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reservas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestiona las citas de tu negocio</p>
        </div>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Total del día</p>
          <p className="text-3xl font-bold text-slate-900">{bookings.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Confirmadas</p>
          <p className="text-3xl font-bold text-emerald-600">{confirmed}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Pendientes</p>
          <p className="text-3xl font-bold text-amber-500">{pending}</p>
        </div>
      </div>

      {loading && <p className="text-slate-400 text-sm">Cargando...</p>}

      {!loading && bookings.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-slate-400 text-sm">No hay reservas para este día</p>
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
              {initials(b.client_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm">{b.client_name}</p>
              <p className="text-slate-400 text-xs">
                {b.service_name || 'Sin servicio'}{b.duration_min ? ` · ${b.duration_min} min` : ''}{b.client_phone ? ` · ${b.client_phone}` : ''}
              </p>
            </div>
            <div className="text-indigo-600 font-bold text-sm shrink-0">
              {formatTime(b.datetime_iso)}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_LABELS[b.status]?.color}`}>
                {STATUS_LABELS[b.status]?.label || b.status}
              </span>
              <select
                value={b.status}
                onChange={(e) => changeStatus(b.id, e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
              >
                <option value="confirmed">Confirmada</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
                <option value="no_show">No asistió</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
