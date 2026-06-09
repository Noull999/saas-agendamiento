import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

const EMPTY_FORM = { name: '', specialty: '', email: '' };

export default function Professionals() {
  const { business } = useAuth();
  const toast = useToast();
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Pro y Business tienen acceso (Business es el tier superior)
  const isPro = business?.plan === 'pro' || business?.plan === 'business';

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
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">👥</div>
        <h2 className="text-xl font-bold text-white mb-2">Disponible en plan Pro</h2>
        <p className="text-zinc-400 text-sm max-w-xs mb-6">Gestiona múltiples profesionales en tu consulta con el plan Pro o Clínica.</p>
        <button className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700">
          Actualizar plan
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

  const doDelete = async () => {
    if (!confirmDelete) return;
    await api.delete(`/professionals/${confirmDelete}`);
    setConfirmDelete(null);
    toast.success('Profesional eliminado');
    load();
  };

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';

  return (
    <div>
      <ConfirmModal
        open={!!confirmDelete}
        title="Eliminar profesional"
        message="¿Eliminar este profesional? No se puede deshacer."
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Profesionales</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Equipo de tu consulta</p>
        </div>
        <button onClick={openNew} className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-700">
          + Agregar profesional
        </button>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Cargando...</p>}

      {!loading && professionals.length === 0 && (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-16 text-center shadow-md shadow-black/20">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-zinc-400 text-sm">No hay profesionales registrados</p>
        </div>
      )}

      <div className="grid gap-3">
        {professionals.map(p => (
          <div key={p.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex items-center gap-4 shadow-md shadow-black/20">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 font-bold text-sm shrink-0">
              {p.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">{p.name}</p>
              <p className="text-zinc-400 text-xs">{p.specialty}{p.email ? ` · ${p.email}` : ''}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(p)} className="text-xs text-red-400 hover:underline">Editar</button>
              <button onClick={() => setConfirmDelete(p.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-white mb-4">{editingId ? 'Editar profesional' : 'Nuevo profesional'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Nombre *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Especialidad *</label>
                <input required value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} className={inputClass} placeholder="Ej: Kinesiología" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-zinc-700 rounded-xl py-2 text-sm text-zinc-300 hover:bg-zinc-800">Cancelar</button>
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
