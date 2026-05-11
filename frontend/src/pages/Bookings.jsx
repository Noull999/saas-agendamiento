import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { StatCard, StatsGrid } from '../components/ui/StatCard';
import { Section, Container, SectionTitle } from '../components/ui/Section';

const STATUS_LABELS = {
  confirmed: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-600' },
  completed: { label: 'Completada', color: 'bg-gray-100 text-gray-600' },
  no_show: { label: 'No asistió', color: 'bg-amber-100 text-amber-700' },
};

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function isValidRut(rut) {
  const cleaned = String(rut).replace(/\./g, '').replace(/-/g, '').trim().toLowerCase();
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0, m = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? '0' : mod === 10 ? 'k' : String(mod);
  return dv === expected;
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

  const inputClass = 'w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <Section gradient className="mb-0">
        <Container>
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">📅 Reservas del Día</h1>
              <p className="text-gray-600">Gestiona y controla todas las citas de tu negocio en tiempo real</p>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent whitespace-nowrap transition-all"
            />
          </div>
        </Container>
      </Section>

      {/* Stats Grid */}
      <Container className="py-12">
        <StatsGrid>
          <StatCard
            title="Total del día"
            value={bookings.length.toString()}
            icon="📅"
            color="blue"
          />
          <StatCard
            title="Confirmadas"
            value={confirmed.toString()}
            icon="✅"
            color="green"
          />
          <StatCard
            title="Con ficha"
            value={bookings.filter(b => b.patient_id).length.toString()}
            icon="👤"
            color="purple"
          />
        </StatsGrid>
      </Container>

      {/* Main Content */}
      <Container className="pb-12">

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          </div>
        )}

        {!loading && bookings.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
            <p className="text-5xl mb-4">📭</p>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin reservas</h3>
            <p className="text-gray-400">No hay reservas programadas para este día</p>
          </div>
        )}

        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
                {initials(b.client_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{b.client_name}</p>
                <p className="text-gray-500 text-sm">
                  {b.service_name || 'Sin servicio'}
                  {b.duration_min && ` • ${b.duration_min} min`}
                  {b.client_phone && ` • ${b.client_phone}`}
                </p>
                <div className="mt-2">
                  {b.patient_name ? (
                    <button
                      onClick={() => navigate(`/dashboard/pacientes/${b.patient_id}`)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      👤 {b.patient_name}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setLinkModal(b.id);
                        setPatientSearch('');
                        setPatientResults([]);
                        setShowNewPatient(false);
                        setNewPatientForm(EMPTY_PATIENT_FORM);
                      }}
                      className="text-sm text-gray-400 hover:text-blue-600 border border-dashed border-gray-300 px-3 py-1 rounded-lg transition-colors"
                    >
                      + Vincular paciente
                    </button>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-blue-600 font-bold text-lg">{formatTime(b.datetime_iso)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {b.patient_id && (
                  <button
                    onClick={() => navigate(`/dashboard/pacientes/${b.patient_id}`)}
                    className="text-sm border border-gray-200 px-3 py-1 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    + Consulta
                  </button>
                )}
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_LABELS[b.status]?.color}`}>
                  {STATUS_LABELS[b.status]?.label || b.status}
                </span>
                <select
                  value={b.status}
                  onChange={(e) => changeStatus(b.id, e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
      </Container>

      {/* Link patient modal */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Vincular paciente</h2>
            {!showNewPatient ? (
              <>
                <input
                  value={patientSearch}
                  onChange={e => searchPatients(e.target.value)}
                  placeholder="Buscar por nombre o RUT..."
                  className={`${inputClass} mb-4`}
                  autoFocus
                />
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                  {patientResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => linkPatient(linkModal, p.id)}
                      disabled={linkSaving}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-lg text-sm transition-colors border border-gray-100"
                    >
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="text-gray-400 text-xs ml-3 font-mono">{p.rut}</span>
                    </button>
                  ))}
                </div>
                {patientSearch && patientResults.length === 0 && (
                  <p className="text-gray-400 text-sm mb-4">No encontrado</p>
                )}
                <button onClick={() => setShowNewPatient(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-4">
                  ➕ Crear nuevo paciente
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setLinkModal(null)} className="flex-1 border-2 border-gray-200 rounded-lg py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">RUT *</label>
                  <input value={newPatientForm.rut} onChange={e => setNewPatientForm({ ...newPatientForm, rut: e.target.value })} placeholder="12.345.678-9" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre *</label>
                  <input value={newPatientForm.name} onChange={e => setNewPatientForm({ ...newPatientForm, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
                  <input value={newPatientForm.phone} onChange={e => setNewPatientForm({ ...newPatientForm, phone: e.target.value })} className={inputClass} />
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowNewPatient(false)} className="flex-1 border-2 border-gray-200 rounded-lg py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">Atrás</button>
                  <button
                    onClick={() => createAndLink(linkModal)}
                    disabled={linkSaving || !newPatientForm.name}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg py-2.5 text-sm font-bold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg"
                  >
                    {linkSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Guardando...
                      </span>
                    ) : '✓ Crear y vincular'}
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
