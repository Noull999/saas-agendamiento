import { useEffect, useState } from 'react';
import api from '../api/client';

const inputClass = 'mt-1.5 w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';

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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Servicios</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Configura los servicios que ofreces</p>
        </div>
        {services.length === 0 && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-16 text-center shadow-md shadow-black/20">
            <p className="text-4xl mb-3">🛠</p>
            <p className="text-zinc-400 text-sm">Aún no tienes servicios. Agrega uno.</p>
          </div>
        )}
        <div className="space-y-3">
          {services.map((s) => (
            <div key={s.id} className={`bg-zinc-900 rounded-2xl border border-zinc-800 p-5 shadow-md shadow-black/20 transition-opacity ${!s.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 font-bold text-sm shrink-0">
                  {s.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white text-sm">{s.name}</p>
                    {!s.active && <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full">Inactivo</span>}
                  </div>
                  {s.description && <p className="text-zinc-500 text-xs mt-0.5">{s.description}</p>}
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-lg">⏱ {s.duration_min} min</span>
                    {s.price && <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg font-medium">${Number(s.price).toLocaleString('es-CL')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(s)} className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                    {s.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => edit(s)} className="text-xs text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Editar</button>
                  <button onClick={() => remove(s.id)} className="text-xs text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-md shadow-black/20 h-fit">
        <h2 className="font-semibold text-white text-sm mb-5">{editing ? 'Editar servicio' : 'Nuevo servicio'}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-300">Nombre *</label>
            <input name="name" required value={form.name} onChange={handle} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-300">Descripción</label>
            <input name="description" value={form.description} onChange={handle} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-300">Duración (min)</label>
              <input name="duration_min" type="number" min="5" value={form.duration_min} onChange={handle} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-300">Precio</label>
              <input name="price" type="number" min="0" value={form.price} onChange={handle} placeholder="Opcional" className={inputClass} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '...' : editing ? 'Guardar cambios' : 'Agregar servicio'}
            </button>
            {editing && (
              <button type="button" onClick={reset} className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
