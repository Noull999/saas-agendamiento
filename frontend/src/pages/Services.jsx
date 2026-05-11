import { useEffect, useState } from 'react';
import api from '../api/client';
import { Section, Container, SectionTitle } from '../components/ui/Section';

const inputClass = 'w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all';

export default function Services() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', duration_min: 60, price: '' });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await api.get('/services');
    setServices(data);
  };

  useEffect(() => { load(); }, []);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const reset = () => { setForm({ name: '', description: '', duration_min: 60, price: '' }); setEditing(null); };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, duration_min: Number(form.duration_min), price: form.price ? Number(form.price) : null };
      if (editing) {
        await api.put(`/services/${editing}`, payload);
      } else {
        await api.post('/services', payload);
      }
      await load();
      reset();
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (s) => { await api.put(`/services/${s.id}`, { active: s.active ? 0 : 1 }); load(); };
  const edit = (s) => { setEditing(s.id); setForm({ name: s.name, description: s.description || '', duration_min: s.duration_min, price: s.price || '' }); };
  const remove = async (id) => { if (!confirm('¿Eliminar este servicio?')) return; await api.delete(`/services/${id}`); load(); };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <Section gradient className="mb-0">
        <Container>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">📋 Servicios</h1>
            <p className="text-gray-600">Configura los servicios que ofreces a tus clientes</p>
          </div>
        </Container>
      </Section>

      <Container className="py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {services.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-16 text-center shadow-sm">
                <p className="text-5xl mb-4">🛠</p>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin servicios aún</h3>
                <p className="text-gray-500">Agrega tu primer servicio para comenzar</p>
              </div>
            )}
            {services.map((s) => (
              <div key={s.id} className={`bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all ${!s.active ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {s.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-gray-900">{s.name}</p>
                      {!s.active && <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">Inactivo</span>}
                    </div>
                    {s.description && <p className="text-gray-600 text-sm mb-3">{s.description}</p>}
                    <div className="flex gap-3 flex-wrap">
                      <span className="text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg font-medium">⏱ {s.duration_min} min</span>
                      {s.price && <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg font-semibold">${Number(s.price).toLocaleString('es-CL')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(s)} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                      {s.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => edit(s)} className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium">Editar</button>
                    <button onClick={() => remove(s.id)} className="px-3 py-2 text-sm text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium">Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm h-fit">
            <h2 className="font-bold text-gray-900 text-lg mb-6">{editing ? '✎ Editar servicio' : '➕ Nuevo servicio'}</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Nombre *</label>
                <input name="name" required value={form.name} onChange={handle} className={inputClass} placeholder="Nombre del servicio" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Descripción</label>
                <input name="description" value={form.description} onChange={handle} className={inputClass} placeholder="Describe brevemente" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Duración (min)</label>
                  <input name="duration_min" type="number" min="5" value={form.duration_min} onChange={handle} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Precio</label>
                  <input name="price" type="number" min="0" value={form.price} onChange={handle} placeholder="Opcional" className={inputClass} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg py-2.5 text-sm font-bold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  {loading ? '⏳ Guardando...' : editing ? '💾 Guardar cambios' : '✓ Agregar servicio'}
                </button>
                {editing && (
                  <button type="button" onClick={reset} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </Container>
    </div>
  );
}
