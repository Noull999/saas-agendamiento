import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { isValidRut } from '../utils/rut';

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

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Pacientes</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{data.total} paciente{data.total !== 1 ? 's' : ''} registrado{data.total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setFormError(''); setForm(EMPTY_FORM); }}
          className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          + Nuevo paciente
        </button>
      </div>

      <div className="mb-4">
        <input
          value={search} onChange={handleSearch}
          placeholder="Buscar por nombre o RUT..."
          className="w-full max-w-sm bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {loading && <p className="text-zinc-500 text-sm">Cargando...</p>}

      {!loading && data.patients.length === 0 && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-16 text-center shadow-md shadow-black/20">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-zinc-400 text-sm">No hay pacientes registrados</p>
        </div>
      )}

      {data.patients.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-md shadow-black/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800 border-b border-zinc-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-400">RUT</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-400">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-400">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-400">Email</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-400">Registrado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {data.patients.map(p => (
                <tr key={p.id} className="hover:bg-zinc-800 transition-colors">
                  <td className="px-4 py-3 font-mono text-zinc-300">{p.rut}</td>
                  <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-zinc-400">{p.email || '—'}</td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(p.created_at).toLocaleDateString('es-CL')}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/dashboard/pacientes/${p.id}`)}
                      className="text-red-400 hover:bg-red-500/10 px-2 py-0.5 rounded-lg text-xs font-medium transition-colors"
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
        <div className="flex gap-2 mt-4">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
            <button
              key={p} onClick={() => load(search, p)}
              className={`px-3 py-1 rounded-lg text-sm ${data.page === p ? 'bg-red-600 text-white' : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-white mb-4">Nuevo paciente</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  RUT *{' '}
                  {rutStatus === 'valid' && <span className="text-emerald-400 font-normal">✓ válido</span>}
                  {rutStatus === 'invalid' && <span className="text-red-400 font-normal">inválido</span>}
                </label>
                <input
                  required value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })}
                  placeholder="12.345.678-9" className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Nombre completo *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Fecha nacimiento</label>
                  <input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Teléfono</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Alergias conocidas</label>
                <textarea rows={2} value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Antecedentes médicos</label>
                <textarea rows={2} value={form.background} onChange={e => setForm({ ...form, background: e.target.value })} className={`${inputClass} resize-none`} />
              </div>
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-zinc-700 rounded-xl py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
