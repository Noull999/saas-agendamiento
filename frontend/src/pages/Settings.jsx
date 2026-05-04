import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Settings() {
  const [form, setForm] = useState({ name: '', phone: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setForm({ name: data.name || '', phone: data.phone || '', description: data.description || '' });
      setLoading(false);
    });
  }, []);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setSaved(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put('/settings', form);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm">Cargando...</p>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-slate-500 text-sm mt-0.5">Actualiza los datos de tu negocio</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre del negocio *</label>
          <input
            name="name" value={form.name} onChange={handleChange} required
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ej: Barbería Don José"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Teléfono de contacto</label>
          <input
            name="phone" value={form.phone} onChange={handleChange}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="+56 9 1234 5678"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción</label>
          <textarea
            name="description" value={form.description} onChange={handleChange} rows={4}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Describe tu negocio para que los clientes sepan qué ofreces..."
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit" disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          {saved && <span className="text-emerald-600 text-sm font-medium">✓ Guardado</span>}
        </div>
      </form>
    </div>
  );
}
