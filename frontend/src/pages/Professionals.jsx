import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Section, Container } from '../components/ui/Section';

const EMPTY_FORM = { name: '', specialty: '', email: '' };

export default function Professionals() {
  const { business } = useAuth();
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isPro = business?.plan === 'pro' || business?.plan === 'clinic';

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/professionals');
      setProfessionals(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isPro) load(); }, [isPro]);

  if (!isPro) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-20">
        <div className="text-7xl mb-6">👥</div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Disponible en plan Pro</h2>
        <p className="text-gray-600 text-center max-w-sm mb-8">Gestiona múltiples profesionales en tu consulta con el plan Pro o Clínica.</p>
        <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg text-sm font-bold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg">
          ⬆️ Actualizar plan
        </button>
      </div>
    );
  }

  const openNew = () => { setEditingId(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
  const openEdit = (p) => { setEditingId(p.id); setForm({ name: p.name, specialty: p.specialty, email: p.email || '' }); setError(''); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/professionals/${editingId}`, form);
      } else {
        await api.post('/professionals', form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este profesional?')) return;
    await api.delete(`/professionals/${id}`);
    load();
  };

  const inputClass = 'w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all';

  return (
    <div className="min-h-screen bg-gray-50">
      <Section gradient className="mb-0">
        <Container>
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">👨‍⚕️ Profesionales</h1>
              <p className="text-gray-600">Equipo de tu consulta</p>
            </div>
            <button onClick={openNew} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg whitespace-nowrap">
              ➕ Agregar profesional
            </button>
          </div>
        </Container>
      </Section>

      <Container className="py-12">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && professionals.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-16 text-center shadow-sm">
            <p className="text-5xl mb-4">👤</p>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin profesionales registrados</h3>
            <p className="text-gray-500">Agrega tu primer profesional para comenzar</p>
          </div>
        )}

        <div className="grid gap-4">
          {professionals.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">
                {p.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{p.name}</p>
                <p className="text-gray-600 text-sm mt-1">{p.specialty}{p.email ? ` · ${p.email}` : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(p)} className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">Editar</button>
                <button onClick={() => remove(p.id)} className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors">Eliminar</button>
              </div>
            </div>
          ))}
        </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingId ? '✎ Editar profesional' : '➕ Nuevo profesional'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Especialidad *</label>
                <input required value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} className={inputClass} placeholder="Ej: Kinesiología" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
              {error && <p className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg">⚠️ {error}</p>}
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
