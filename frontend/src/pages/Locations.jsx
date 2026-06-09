import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';

const EMPTY_FORM = { name: '', address: '', phone: '', slug_suffix: '' };

export default function Locations() {
  const toast = useToast();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/locations');
      setLocations(data);
    } catch {
      toast.error('Error cargando sucursales');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (loc) => {
    setEditingId(loc.id);
    setFormData({ name: loc.name, address: loc.address || '', phone: loc.phone || '', slug_suffix: loc.slug_suffix || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Nombre requerido'); return; }
    if (!editingId && !formData.slug_suffix.trim()) { toast.error('Slug requerido'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/locations/${editingId}`, {
          name: formData.name,
          address: formData.address || null,
          phone: formData.phone || null,
        });
        toast.success('Sucursal actualizada');
      } else {
        await api.post('/locations', formData);
        toast.success('Sucursal creada');
      }
      setShowForm(false);
      setFormData(EMPTY_FORM);
      setEditingId(null);
      fetchLocations();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando sucursal');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (loc) => {
    try {
      await api.patch(`/locations/${loc.id}`, { active: !loc.active });
      toast.success(loc.active ? 'Sucursal desactivada' : 'Sucursal activada');
      fetchLocations();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error actualizando sucursal');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta sucursal? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/locations/${id}`);
      toast.success('Sucursal eliminada');
      fetchLocations();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error eliminando sucursal');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500';

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Sucursales</h1>
          <p className="text-zinc-400 text-sm mt-1">Gestiona múltiples ubicaciones desde una cuenta</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          + Nueva sucursal
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 mb-6 space-y-3">
          <h2 className="text-white font-semibold mb-1">{editingId ? 'Editar sucursal' : 'Nueva sucursal'}</h2>
          <input
            type="text"
            placeholder="Nombre (ej: Sede Providencia)"
            value={formData.name}
            onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Dirección (opcional)"
            value={formData.address}
            onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Teléfono (opcional)"
            value={formData.phone}
            onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
            className={inputClass}
          />
          {!editingId && (
            <div>
              <input
                type="text"
                placeholder="URL slug (ej: providencia)"
                value={formData.slug_suffix}
                onChange={e => setFormData(f => ({ ...f, slug_suffix: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className={inputClass}
              />
              {formData.slug_suffix && (
                <p className="text-zinc-500 text-xs mt-1 font-mono">
                  URL pública: /book/{formData.slug_suffix}
                </p>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-xl font-medium transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-xl font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2].map(n => (
            <div key={n} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-zinc-700 rounded w-48 mb-2" />
              <div className="h-3 bg-zinc-800 rounded w-32" />
            </div>
          ))}
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-medium">Sin sucursales</p>
          <p className="text-sm mt-1">Crea tu primera sucursal para empezar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map(loc => (
            <div
              key={loc.id}
              className={`bg-zinc-900 border rounded-xl p-5 transition-opacity ${loc.active ? 'border-zinc-800' : 'border-zinc-800 opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{loc.name}</h3>
                    {!loc.active && <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">Inactiva</span>}
                  </div>
                  {loc.address && <p className="text-zinc-400 text-sm mt-0.5">{loc.address}</p>}
                  {loc.phone && <p className="text-zinc-400 text-sm">Tel: {loc.phone}</p>}
                  {loc.slug_suffix && (
                    <a
                      href={`/book/${loc.slug_suffix}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-500 hover:text-red-400 text-xs font-mono mt-1 block transition-colors"
                    >
                      /book/{loc.slug_suffix} ↗
                    </a>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(loc)}
                    className="text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(loc)}
                    className="text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    {loc.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => handleDelete(loc.id)}
                    className="text-red-400 hover:text-red-300 text-sm px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
