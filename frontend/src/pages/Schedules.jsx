import { useEffect, useState } from 'react';
import api from '../api/client';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const DEFAULT_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

export default function Schedules() {
  const [schedules, setSchedules] = useState({});
  const [saving, setSaving] = useState(null);

  const load = async () => {
    const { data } = await api.get('/schedules');
    const map = {};
    data.forEach((s) => { map[s.dow] = s.slots; });
    setSchedules(map);
  };

  useEffect(() => { load(); }, []);

  const toggleSlot = (dow, slot) => {
    const current = schedules[dow] || [];
    const next = current.includes(slot)
      ? current.filter((s) => s !== slot)
      : [...current, slot].sort();
    setSchedules({ ...schedules, [dow]: next });
  };

  const save = async (dow) => {
    setSaving(dow);
    try {
      await api.post('/schedules', { dow, slots: schedules[dow] || [] });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6">Horarios disponibles</h1>
      <p className="text-sm text-zinc-400 mb-6">Selecciona los horarios disponibles para cada día. Los clientes podrán elegir entre estos bloques al agendar.</p>

      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
          <div key={dow} className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white text-sm">{DAYS[dow]}</h2>
              <button
                onClick={() => save(dow)}
                disabled={saving === dow}
                className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving === dow ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SLOTS.map((slot) => {
                const active = (schedules[dow] || []).includes(slot);
                return (
                  <button
                    key={slot}
                    onClick={() => toggleSlot(dow, slot)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-red-500/50'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
            {(schedules[dow] || []).length === 0 && (
              <p className="text-xs text-zinc-600 mt-2">Día sin horarios (no disponible)</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
