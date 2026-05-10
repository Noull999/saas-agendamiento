import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { isValidRut } from '../utils/rut';

const STATUS_LABELS = {
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-600' },
  completed: { label: 'Completada', color: 'bg-slate-100 text-slate-600' },
  no_show: { label: 'No asistió', color: 'bg-amber-100 text-amber-700' },
};

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}


const EMPTY_PATIENT_FORM = { rut: '', name: '', phone: '', email: '' };

export default function Bookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const [linkModal, setLinkModal] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [newPatientForm, setNewPatientForm] = useState(EMPTY_PATIENT_FORM);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bookings', { params: { date } });
      setBookings(data.bookings ?? data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date]);

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

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;

  const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

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
          <p className="text-sm text-slate-500 mb-1">Con ficha</p>
          <p className="text-3xl font-bold text-indigo-600">{bookings.filter(b => b.patient_id).length}</p>
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

      {/* Link patient modal */}
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
