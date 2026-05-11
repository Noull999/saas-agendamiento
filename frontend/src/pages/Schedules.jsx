import { useEffect, useState } from 'react';
import api from '../api/client';
import { Section, Container, SectionTitle } from '../components/ui/Section';

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
    <div className="min-h-screen bg-gray-50">
      <Section gradient className="mb-0">
        <Container>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">⏰ Horarios disponibles</h1>
            <p className="text-gray-600">Configura los horarios en los que puedes recibir reservas</p>
          </div>
        </Container>
      </Section>

      <Container className="py-12">
        <div className="space-y-6">
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
            <div key={dow} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">{DAYS[dow]}</h2>
                  <p className="text-sm text-gray-500 mt-1">{(schedules[dow] || []).length} horarios disponibles</p>
                </div>
                <button
                  onClick={() => save(dow)}
                  disabled={saving === dow}
                  className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  {saving === dow ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </span>
                  ) : '💾 Guardar'}
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {DEFAULT_SLOTS.map((slot) => {
                  const active = (schedules[dow] || []).includes(slot);
                  return (
                    <button
                      key={slot}
                      onClick={() => toggleSlot(dow, slot)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all transform ${
                        active
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-sm'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
              {(schedules[dow] || []).length === 0 && (
                <p className="text-sm text-gray-500 mt-4 p-3 bg-gray-50 rounded-lg">📅 Día sin horarios (no disponible para reservas)</p>
              )}
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
