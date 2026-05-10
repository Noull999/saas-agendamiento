import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { VERTICALS } from '../config/verticals.config';

export default function Settings() {
  const { business, updateBusiness } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', description: '', vertical: 'salud' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setForm({
        name: data.name || '',
        phone: data.phone || '',
        description: data.description || '',
        vertical: data.vertical || 'salud',
      });
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
      const { data } = await api.put('/settings', form);
      updateBusiness({ name: data.name, vertical: data.vertical });
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
            name="description" value={form.description} onChange={handleChange} rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Describe tu negocio para que los clientes sepan qué ofreces..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de negocio</label>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(VERTICALS).map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => { setForm(f => ({ ...f, vertical: v.id })); setSaved(false); }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  form.vertical === v.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-2xl">{v.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${form.vertical === v.id ? 'text-indigo-700' : 'text-slate-700'}`}>{v.label}</p>
                  <p className="text-xs text-slate-400 leading-tight mt-0.5">{v.description}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Cambia el formulario de reserva y el menú del dashboard.</p>
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
