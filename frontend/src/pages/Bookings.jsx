import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { isValidRut } from '../utils/rut';

const STATUS_LABELS = {
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  cancelled:  { label: 'Cancelada',  color: 'bg-red-100 text-red-600'        },
  completed:  { label: 'Completada', color: 'bg-slate-100 text-slate-600'    },
  no_show:    { label: 'No asistió', color: 'bg-amber-100 text-amber-700'    },
};

const STATUS_COLORS = {
  confirmed: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  cancelled:  'bg-red-50 border-red-200 text-red-700',
  completed:  'bg-slate-50 border-slate-200 text-slate-600',
  no_show:    'bg-amber-50 border-amber-200 text-amber-700',
};

const DAYS_ES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.getTime() === today.getTime())    return 'Hoy';
  if (d.getTime() === tomorrow.getTime()) return 'Mañana';
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function groupByDate(bookings) {
  const map = {};
  for (const b of bookings) {
    const day = b.datetime_iso.slice(0, 10);
    if (!map[day]) map[day] = [];
    map[day].push(b);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

// Returns Monday of the week containing `date`
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// ─── Calendar week view ─────────────────────────────────────────────────────
function CalendarView({ bookings, onChangeStatus, onLinkClick, navigate }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 6);

  const byDate = {};
  bookings.forEach(b => {
    const key = b.datetime_iso.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(b);
  });

  const monthLabel = () => {
    const ms = MONTHS_ES[weekStart.getMonth()];
    const me = MONTHS_ES[weekEnd.getMonth()];
    const ys = weekStart.getFullYear();
    const ye = weekEnd.getFullYear();
    if (ms === me && ys === ye) return `${ms} ${ys}`;
    if (ys === ye) return `${ms} – ${me} ${ys}`;
    return `${ms} ${ys} – ${me} ${ye}`;
  };

  const todayStr = isoDate(new Date());

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekStart(w => addDays(w, -7))}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm"
        >
          ← Anterior
        </button>
        <div className="text-center">
          <p className="font-semibold text-slate-800 capitalize text-sm">{monthLabel()}</p>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="text-xs text-indigo-500 hover:underline mt-0.5"
          >
            Ir a esta semana
          </button>
        </div>
        <button
          onClick={() => setWeekStart(w => addDays(w, 7))}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm"
        >
          Siguiente →
        </button>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const key   = isoDate(day);
          const items = byDate[key] || [];
          const isToday = key === todayStr;
          return (
            <div key={key} className="min-h-[140px]">
              {/* Day header */}
              <div className={`text-center py-2 mb-1.5 rounded-xl text-xs font-semibold ${
                isToday ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <p>{DAYS_SHORT[day.getDay()]}</p>
                <p className={`text-base font-bold leading-tight ${isToday ? 'text-white' : 'text-slate-800'}`}>
                  {day.getDate()}
                </p>
              </div>

              {/* Bookings for this day */}
              <div className="space-y-1">
                {items.map(b => (
                  <div
                    key={b.id}
                    className={`rounded-lg border px-1.5 py-1 text-xs cursor-pointer hover:shadow-sm transition-shadow ${STATUS_COLORS[b.status] || 'bg-slate-50 border-slate-200'}`}
                    onClick={() => b.patient_id && navigate(`/dashboard/pacientes/${b.patient_id}`)}
                    title={`${b.client_name} · ${formatTime(b.datetime_iso)}`}
                  >
                    <p className="font-semibold truncate leading-tight">{formatTime(b.datetime_iso)}</p>
                    <p className="truncate opacity-80 leading-tight">{b.client_name}</p>
                    {b.service_name && (
                      <p className="truncate opacity-60 leading-tight text-[10px]">{b.service_name}</p>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-center text-slate-200 text-[10px] mt-4">–</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
const EMPTY_PATIENT_FORM = { rut: '', name: '', phone: '', email: '' };

export default function Bookings() {
  const navigate = useNavigate();
  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode]         = useState('lista'); // 'lista' | 'semana'

  const [linkModal, setLinkModal]           = useState(null);
  const [patientSearch, setPatientSearch]   = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [newPatientForm, setNewPatientForm] = useState(EMPTY_PATIENT_FORM);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [linkSaving, setLinkSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const params = { from: today, limit: 200 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/bookings', { params });
      setBookings(data.bookings ?? data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const changeStatus = async (id, status) => {
    await api.patch(`/bookings/${id}/status`, { status });
    load();
  };

  const searchPatients = async (q) => {
    setPatientSearch(q);
    if (!q) { setPatientResults([]); return; }
    const { data } = await api.get('/patients', { params: { search: q, limit: 5 } });
    setPatientResults(data.patients);
  };

  const linkPatient = async (bookingId, patientId) => {
    setLinkSaving(true);
    try {
      await api.put(`/bookings/${bookingId}`, { patient_id: patientId });
      load();
      setLinkModal(null);
      setPatientSearch('');
      setPatientResults([]);
    } finally {
      setLinkSaving(false);
    }
  };

  const createAndLink = async (bookingId) => {
    if (!isValidRut(newPatientForm.rut)) { alert('RUT inválido'); return; }
    setLinkSaving(true);
    try {
      const { data: p } = await api.post('/patients', { ...newPatientForm });
      await api.put(`/bookings/${bookingId}`, { patient_id: p.id });
      load();
      setLinkModal(null);
      setShowNewPatient(false);
      setNewPatientForm(EMPTY_PATIENT_FORM);
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    } finally {
      setLinkSaving(false);
    }
  };

  const groups    = groupByDate(bookings);
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reservas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Próximas citas de tu negocio</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-slate-200 rounded-xl overflow-hidden text-sm">
            <button
              onClick={() => setViewMode('lista')}
              className={`px-4 py-2 font-medium transition-colors ${viewMode === 'lista' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode('semana')}
              className={`px-4 py-2 font-medium transition-colors ${viewMode === 'semana' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Semana
            </button>
          </div>
          {/* Status filter (only in list mode) */}
          {viewMode === 'lista' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos los estados</option>
              <option value="confirmed">Confirmadas</option>
              <option value="completed">Completadas</option>
              <option value="cancelled">Canceladas</option>
              <option value="no_show">No asistió</option>
            </select>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Total próximas</p>
          <p className="text-3xl font-bold text-slate-900">{bookings.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Confirmadas</p>
          <p className="text-3xl font-bold text-emerald-600">{confirmed}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Con ficha</p>
          <p className="text-3xl font-bold text-indigo-600">{bookings.filter(b => b.patient_id).length}</p>
        </div>
      </div>

      {loading && <p className="text-slate-400 text-sm">Cargando...</p>}

      {!loading && bookings.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-slate-400 text-sm">No hay reservas próximas</p>
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {!loading && viewMode === 'semana' && bookings.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm overflow-x-auto">
          <CalendarView
            bookings={bookings}
            onChangeStatus={changeStatus}
            navigate={navigate}
          />
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && viewMode === 'lista' && (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-semibold text-slate-700 capitalize">{formatDate(day)}</span>
                <span className="text-xs text-slate-400">{day}</span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400">{items.length} cita{items.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-2">
                {items.map((b) => (
                  <div key={b.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                      {initials(b.client_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{b.client_name}</p>
                      <p className="text-slate-400 text-xs">
                        {b.service_name || 'Sin servicio'}{b.duration_min ? ` · ${b.duration_min} min` : ''}{b.client_phone ? ` · ${b.client_phone}` : ''}
                      </p>
                      <div className="mt-1">
                        {b.patient_name ? (
                          <button
                            onClick={() => navigate(`/dashboard/pacientes/${b.patient_id}`)}
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            👤 {b.patient_name}
                          </button>
                        ) : (
                          <button
                            onClick={() => { setLinkModal(b.id); setPatientSearch(''); setPatientResults([]); setShowNewPatient(false); setNewPatientForm(EMPTY_PATIENT_FORM); }}
                            className="text-xs text-slate-400 hover:text-indigo-600 border border-dashed border-slate-200 px-2 py-0.5 rounded-lg"
                          >
                            Vincular paciente
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-indigo-600 font-bold text-sm shrink-0">{formatTime(b.datetime_iso)}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      {b.patient_id && (
                        <button
                          onClick={() => navigate(`/dashboard/pacientes/${b.patient_id}`)}
                          className="text-xs border border-slate-200 px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-50"
                        >
                          Nueva consulta
                        </button>
                      )}
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
          ))}
        </div>
      )}

      {/* Modal vincular paciente */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Vincular paciente</h2>
            {!showNewPatient ? (
              <>
                <input
                  value={patientSearch}
                  onChange={e => searchPatients(e.target.value)}
                  placeholder="Buscar por nombre o RUT..."
                  className={`${inputClass} mb-3`}
                />
                {patientResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => linkPatient(linkModal, p.id)}
                    disabled={linkSaving}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl text-sm mb-1"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-slate-400 text-xs ml-2 font-mono">{p.rut}</span>
                  </button>
                ))}
                {patientSearch && patientResults.length === 0 && (
                  <p className="text-slate-400 text-xs mb-3">No encontrado.</p>
                )}
                <button onClick={() => setShowNewPatient(true)} className="text-sm text-indigo-600 hover:underline mt-2 block">
                  + Crear nuevo paciente
                </button>
                <div className="mt-4">
                  <button onClick={() => setLinkModal(null)} className="w-full border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">RUT *</label>
                  <input value={newPatientForm.rut} onChange={e => setNewPatientForm({ ...newPatientForm, rut: e.target.value })} placeholder="12.345.678-9" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre *</label>
                  <input value={newPatientForm.name} onChange={e => setNewPatientForm({ ...newPatientForm, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input value={newPatientForm.phone} onChange={e => setNewPatientForm({ ...newPatientForm, phone: e.target.value })} className={inputClass} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowNewPatient(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50">Atrás</button>
                  <button
                    onClick={() => createAndLink(linkModal)}
                    disabled={linkSaving || !newPatientForm.name}
                    className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {linkSaving ? 'Guardando...' : 'Crear y vincular'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
