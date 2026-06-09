import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { isValidRut } from '../utils/rut';
import { useToast } from '../context/ToastContext';
import { SkeletonTable } from '../components/Skeleton';

const STATUS_LABELS = {
  confirmed: { label: 'Confirmada', color: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' },
  cancelled:  { label: 'Cancelada',  color: 'bg-red-500/10 border border-red-500/30 text-red-400'           },
  completed:  { label: 'Completada', color: 'bg-zinc-700/50 border border-zinc-600 text-zinc-300'           },
  no_show:    { label: 'No asistió', color: 'bg-amber-500/10 border border-amber-500/30 text-amber-400'     },
};

const STATUS_COLORS = {
  confirmed: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  cancelled:  'bg-red-500/10 border-red-500/30 text-red-400',
  completed:  'bg-zinc-700/50 border-zinc-600 text-zinc-300',
  no_show:    'bg-amber-500/10 border-amber-500/30 text-amber-400',
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
function CalendarView({ bookings, navigate }) {
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
          className="p-2 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm"
        >
          ← Anterior
        </button>
        <div className="text-center">
          <p className="font-semibold text-white capitalize text-sm">{monthLabel()}</p>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="text-xs text-red-400 hover:underline mt-0.5"
          >
            Ir a esta semana
          </button>
        </div>
        <button
          onClick={() => setWeekStart(w => addDays(w, 7))}
          className="p-2 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm"
        >
          Siguiente →
        </button>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const key   = isoDate(day);
          const items = byDate[key] || [];
          const isToday = key === todayStr;
          return (
            <div key={key} className="min-h-[140px]">
              {/* Day header */}
              <div className={`text-center py-2 mb-1.5 rounded-xl text-xs font-semibold ${
                isToday ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}>
                <p>{DAYS_SHORT[day.getDay()]}</p>
                <p className={`text-base font-bold leading-tight ${isToday ? 'text-white' : 'text-zinc-300'}`}>
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
                  <p className="text-center text-zinc-700 text-[10px] mt-4">–</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Monthly calendar view ───────────────────────────────────────────────────
function MonthView({ bookings, navigate }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = month.getFullYear();
  const mon  = month.getMonth();
  const firstDay = new Date(year, mon, 1);
  const lastDay  = new Date(year, mon + 1, 0);

  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday=0
  const totalCells = startDow + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);

  const byDate = {};
  bookings.forEach(b => {
    const key = b.datetime_iso.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(b);
  });

  const cells = [];
  for (let i = 0; i < rows * 7; i++) {
    const dayNum = i - startDow + 1;
    cells.push(dayNum >= 1 && dayNum <= lastDay.getDate()
      ? new Date(year, mon, dayNum)
      : null
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const MONTHS_CAP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonth(new Date(year, mon - 1, 1))}
          className="p-2 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm transition-colors"
        >
          ← Anterior
        </button>
        <div className="text-center">
          <span className="text-white font-semibold">{MONTHS_CAP[mon]} {year}</span>
          <button
            onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            className="block text-xs text-red-400 hover:underline mt-0.5 mx-auto"
          >
            Ir a este mes
          </button>
        </div>
        <button
          onClick={() => setMonth(new Date(year, mon + 1, 1))}
          className="p-2 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm transition-colors"
        >
          Siguiente →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="text-center text-xs text-zinc-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-20 rounded-lg bg-zinc-900/30" />;
          const dateStr = `${year}-${String(mon+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const dayBookings = byDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`h-20 rounded-lg p-1.5 border cursor-pointer hover:border-zinc-600 transition-colors overflow-hidden ${
                isToday ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-800 bg-zinc-900'
              }`}
              onClick={() => navigate(`/dashboard?date=${dateStr}`)}
            >
              <span className={`text-xs font-medium ${isToday ? 'text-red-400' : 'text-zinc-400'}`}>
                {d.getDate()}
              </span>
              {dayBookings.slice(0, 2).map(b => (
                <div key={b.id} className="mt-0.5 text-[10px] bg-red-500/20 text-red-300 rounded px-1 truncate">
                  {b.datetime_iso.slice(11, 16)} {b.client_name.split(' ')[0]}
                </div>
              ))}
              {dayBookings.length > 2 && (
                <div className="text-[10px] text-zinc-500 mt-0.5">+{dayBookings.length - 2} más</div>
              )}
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
  const toast = useToast();
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
    if (!isValidRut(newPatientForm.rut)) { toast.error('RUT inválido'); return; }
    setLinkSaving(true);
    try {
      const { data: p } = await api.post('/patients', { ...newPatientForm });
      await api.put(`/bookings/${bookingId}`, { patient_id: p.id });
      load();
      setLinkModal(null);
      setShowNewPatient(false);
      setNewPatientForm(EMPTY_PATIENT_FORM);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setLinkSaving(false);
    }
  };

  const groups    = groupByDate(bookings);
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Reservas</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Próximas citas de tu negocio</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-zinc-700 rounded-xl overflow-hidden text-sm">
            <button
              onClick={() => setViewMode('lista')}
              className={`px-4 py-2 font-medium transition-colors ${viewMode === 'lista' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode('semana')}
              className={`px-4 py-2 font-medium transition-colors ${viewMode === 'semana' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('mes')}
              className={`px-4 py-2 font-medium transition-colors ${viewMode === 'mes' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              Mes
            </button>
          </div>
          {/* Status filter (only in list mode) */}
          {viewMode === 'lista' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-2 text-sm shadow-md shadow-black/20 focus:outline-none focus:ring-2 focus:ring-red-500"
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 rounded-2xl p-5 shadow-md shadow-black/20 border border-zinc-800">
          <p className="text-sm text-zinc-400 mb-1">Total próximas</p>
          <p className="text-3xl font-bold text-white">{bookings.length}</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-5 shadow-md shadow-black/20 border border-zinc-800">
          <p className="text-sm text-zinc-400 mb-1">Confirmadas</p>
          <p className="text-3xl font-bold text-emerald-400">{confirmed}</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-5 shadow-md shadow-black/20 border border-zinc-800">
          <p className="text-sm text-zinc-400 mb-1">Con ficha</p>
          <p className="text-3xl font-bold text-red-400">{bookings.filter(b => b.patient_id).length}</p>
        </div>
        <div className="bg-zinc-900 rounded-2xl p-5 shadow-md shadow-black/20 border border-zinc-800">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M11.99 2C6.472 2 2 6.471 2 11.988c0 1.776.465 3.442 1.27 4.89L2 22l5.265-1.256A9.966 9.966 0 0011.99 22C17.51 22 22 17.529 22 12.012 22 6.495 17.51 2 11.99 2z"/>
            </svg>
            <p className="text-sm text-zinc-400">Recordatorios enviados</p>
          </div>
          <p className="text-3xl font-bold text-green-400">{bookings.filter(b => b.reminder_sent).length}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {bookings.length - bookings.filter(b => b.reminder_sent).length} pendientes
          </p>
        </div>
      </div>

      {loading && <SkeletonTable rows={6} />}

      {!loading && bookings.length === 0 && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-16 text-center shadow-md shadow-black/20">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-zinc-400 text-sm">No hay reservas próximas</p>
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {!loading && viewMode === 'semana' && bookings.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 shadow-md shadow-black/20 overflow-x-auto">
          <CalendarView
            bookings={bookings}
            onChangeStatus={changeStatus}
            navigate={navigate}
          />
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {!loading && viewMode === 'mes' && bookings.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 shadow-md shadow-black/20">
          <MonthView bookings={bookings} navigate={navigate} />
        </div>
      )}
      {!loading && viewMode === 'mes' && bookings.length === 0 && null}

      {/* ── LIST VIEW ── */}
      {!loading && viewMode === 'lista' && (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-semibold text-zinc-300 capitalize">{formatDate(day)}</span>
                <span className="text-xs text-zinc-500">{day}</span>
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-500">{items.length} cita{items.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-2">
                {items.map((b) => (
                  <div key={b.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex items-center gap-4 shadow-md shadow-black/20">
                    <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 font-bold text-sm shrink-0">
                      {initials(b.client_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{b.client_name}</p>
                      <p className="text-zinc-400 text-xs">
                        {b.service_name || 'Sin servicio'}{b.duration_min ? ` · ${b.duration_min} min` : ''}{b.client_phone ? ` · ${b.client_phone}` : ''}
                      </p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {/* Origen de la reserva */}
                        {b.source === 'whatsapp' && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.472 2 2 6.471 2 11.988c0 1.776.465 3.442 1.27 4.89L2 22l5.265-1.256A9.966 9.966 0 0011.99 22C17.51 22 22 17.529 22 12.012 22 6.495 17.51 2 11.99 2z"/></svg>
                            WhatsApp
                          </span>
                        )}
                        {/* Recordatorio WhatsApp */}
                        {b.reminder_sent ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.472 2 2 6.471 2 11.988c0 1.776.465 3.442 1.27 4.89L2 22l5.265-1.256A9.966 9.966 0 0011.99 22C17.51 22 22 17.529 22 12.012 22 6.495 17.51 2 11.99 2z"/></svg>
                            Recordatorio enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.472 2 2 6.471 2 11.988c0 1.776.465 3.442 1.27 4.89L2 22l5.265-1.256A9.966 9.966 0 0011.99 22C17.51 22 22 17.529 22 12.012 22 6.495 17.51 2 11.99 2z"/></svg>
                            Recordatorio pendiente
                          </span>
                        )}
                        {b.patient_name ? (
                          <button
                            onClick={() => navigate(`/dashboard/pacientes/${b.patient_id}`)}
                            className="text-xs text-red-400 hover:underline"
                          >
                            👤 {b.patient_name}
                          </button>
                        ) : (
                          <button
                            onClick={() => { setLinkModal(b.id); setPatientSearch(''); setPatientResults([]); setShowNewPatient(false); setNewPatientForm(EMPTY_PATIENT_FORM); }}
                            className="text-xs text-zinc-500 hover:text-red-400 border border-dashed border-zinc-700 hover:border-red-500/50 px-2 py-0.5 rounded-lg"
                          >
                            Vincular paciente
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-red-400 font-bold text-sm shrink-0">{formatTime(b.datetime_iso)}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      {b.patient_id && (
                        <button
                          onClick={() => navigate(`/dashboard/pacientes/${b.patient_id}`)}
                          className="text-xs border border-zinc-700 px-2 py-1 rounded-lg text-zinc-300 hover:bg-zinc-800"
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
                        className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-red-500"
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-4">Vincular paciente</h2>
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
                    className="w-full text-left px-3 py-2 hover:bg-zinc-800 rounded-xl text-sm mb-1"
                  >
                    <span className="font-medium text-white">{p.name}</span>
                    <span className="text-zinc-400 text-xs ml-2 font-mono">{p.rut}</span>
                  </button>
                ))}
                {patientSearch && patientResults.length === 0 && (
                  <p className="text-zinc-500 text-xs mb-3">No encontrado.</p>
                )}
                <button onClick={() => setShowNewPatient(true)} className="text-sm text-red-400 hover:underline mt-2 block">
                  + Crear nuevo paciente
                </button>
                <div className="mt-4">
                  <button onClick={() => setLinkModal(null)} className="w-full border border-zinc-700 rounded-xl py-2 text-sm text-zinc-300 hover:bg-zinc-800">Cancelar</button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">RUT *</label>
                  <input value={newPatientForm.rut} onChange={e => setNewPatientForm({ ...newPatientForm, rut: e.target.value })} placeholder="12.345.678-9" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Nombre *</label>
                  <input value={newPatientForm.name} onChange={e => setNewPatientForm({ ...newPatientForm, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Teléfono</label>
                  <input value={newPatientForm.phone} onChange={e => setNewPatientForm({ ...newPatientForm, phone: e.target.value })} className={inputClass} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowNewPatient(false)} className="flex-1 border border-zinc-700 rounded-xl py-2 text-sm text-zinc-300 hover:bg-zinc-800">Atrás</button>
                  <button
                    onClick={() => createAndLink(linkModal)}
                    disabled={linkSaving || !newPatientForm.name}
                    className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
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
