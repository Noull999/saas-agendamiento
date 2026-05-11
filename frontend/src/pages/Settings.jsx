import { useEffect, useState } from 'react';
import api from '../api/client';
import { Section, Container } from '../components/ui/Section';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Section gradient className="mb-0">
        <Container>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">⚙️ Configuración</h1>
            <p className="text-gray-600">Actualiza los datos de tu negocio</p>
          </div>
        </Container>
      </Section>

      <Container className="py-12">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Nombre del negocio *</label>
              <input
                name="name" value={form.name} onChange={handleChange} required
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all"
                placeholder="Ej: Barbería Don José"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Teléfono de contacto</label>
              <input
                name="phone" value={form.phone} onChange={handleChange}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all"
                placeholder="+56 9 1234 5678"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Descripción</label>
              <textarea
                name="description" value={form.description} onChange={handleChange} rows={4}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all resize-none"
                placeholder="Describe tu negocio para que los clientes sepan qué ofreces..."
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm font-medium bg-red-50 p-4 rounded-lg">⚠️ {error}</p>
            )}

            <div className="flex items-center gap-4 pt-4">
              <button
                type="submit" disabled={saving}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white font-bold text-sm px-8 py-3 rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Guardando...
                  </span>
                ) : '💾 Guardar cambios'}
              </button>
              {saved && <span className="text-emerald-600 text-sm font-bold flex items-center gap-1">✓ Guardado con éxito</span>}
            </div>
          </form>
        </div>
      </Container>
    </div>
  );
}
