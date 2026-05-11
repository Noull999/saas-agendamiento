import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Section, Container } from '../components/ui/Section';

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

const EMPTY_FORM = { rut: '', name: '', birth_date: '', phone: '', email: '', allergies: '', background: '' };

export default function Patients() {
  const navigate = useNavigate();
  const [data, setData] = useState({ patients: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
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

  const rutStatus = form.rut.length > 2
    ? (isValidRut(form.rut) ? 'valid' : 'invalid')
    : 'neutral';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidRut(form.rut)) { setFormError('RUT inválido'); return; }
    setSaving(true);
    setFormError('');
    try {
      await api.post('/patients', form);
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all';

  return (
    <div className="min-h-screen bg-gray-50">
      <Section gradient className="mb-0">
        <Container>
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">👥 Pacientes</h1>
              <p className="text-gray-600">{data.total} paciente{data.total !== 1 ? 's' : ''} registrado{data.total !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => { setShowModal(true); setFormError(''); setForm(EMPTY_FORM); }}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg whitespace-nowrap"
            >
              ➕ Nuevo paciente
            </button>
          </div>
        </Container>
      </Section>

      <Container className="py-12">
        <div className="mb-6">
          <input
            value={search} onChange={handleSearch}
            placeholder="🔍 Buscar por nombre o RUT..."
            className={`w-full max-w-lg ${inputClass}`}
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && data.patients.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-16 text-center shadow-sm">
            <p className="text-5xl mb-4">👤</p>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin pacientes registrados</h3>
            <p className="text-gray-500">Comienza agregando tu primer paciente</p>
          </div>
        )}

        {data.patients.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold text-gray-900">RUT</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-900">Nombre</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-900">Teléfono</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-900">Email</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-900">Registrado</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.patients.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-700 font-medium">{p.rut}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{p.name}</td>
                    <td className="px-6 py-4 text-gray-600">{p.phone || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{p.email || '—'}</td>
                    <td className="px-6 py-4 text-gray-500">{new Date(p.created_at).toLocaleDateString('es-CL')}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/dashboard/pacientes/${p.id}`)}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        Ver ficha →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.pages > 1 && (
          <div className="flex gap-2 mt-6 justify-center">
            {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
              <button
                key={p} onClick={() => load(search, p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${data.page === p ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Nuevo paciente</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  RUT *{' '}
                  {rutStatus === 'valid' && <span className="text-emerald-600 font-normal">✓ válido</span>}
                  {rutStatus === 'invalid' && <span className="text-red-500 font-normal">inválido</span>}
                </label>
                <input
                  required value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })}
                  placeholder="12.345.678-9" className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre completo *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha nacimiento</label>
                  <input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Teléfono</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Alergias conocidas</label>
                <textarea rows={2} value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Antecedentes médicos</label>
                <textarea rows={2} value={form.background} onChange={e => setForm({ ...form, background: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              {formError && <p className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg">⚠️ {formError}</p>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border-2 border-gray-200 rounded-lg py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg py-2.5 text-sm font-bold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg">
                  {saving ? '⏳ Guardando...' : '✓ Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
