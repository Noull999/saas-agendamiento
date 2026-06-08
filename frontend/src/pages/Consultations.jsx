import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Consultations() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/consultations', { params: date ? { date } : {} });
      setConsultations(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date]);

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Consultas</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Historial de consultas médicas</p>
        </div>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-2 text-sm shadow-md shadow-black/20 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-md shadow-black/20 overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-zinc-500 text-sm">Cargando...</div>
        )}

        {!loading && consultations.length === 0 && (
          <div className="p-16 text-center">
            <p className="text-4xl mb-3">🩺</p>
            <p className="text-zinc-400 text-sm">No hay consultas registradas{date ? ' para esta fecha' : ''}</p>
          </div>
        )}

        {!loading && consultations.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-zinc-800 border-b border-zinc-700">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Paciente</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Profesional</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Diagnóstico</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {consultations.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-800 transition-colors">
                  <td className="px-5 py-3 text-zinc-400 whitespace-nowrap">{formatDate(c.created_at)}</td>
                  <td className="px-5 py-3 font-medium text-white">{c.patient_name || '—'}</td>
                  <td className="px-5 py-3 text-zinc-400">{c.professional_name || '—'}</td>
                  <td className="px-5 py-3 text-zinc-400 max-w-xs truncate">{c.diagnosis || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => navigate(`/dashboard/pacientes/${c.patient_id}`)}
                      className="text-xs text-red-400 hover:underline font-medium"
                    >
                      Ver ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
