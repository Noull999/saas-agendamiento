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
          <h1 className="text-2xl font-bold text-slate-900">Consultas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Historial de consultas médicas</p>
        </div>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
        )}

        {!loading && consultations.length === 0 && (
          <div className="p-16 text-center">
            <p className="text-4xl mb-3">🩺</p>
            <p className="text-slate-400 text-sm">No hay consultas registradas{date ? ' para esta fecha' : ''}</p>
          </div>
        )}

        {!loading && consultations.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paciente</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Profesional</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Diagnóstico</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {consultations.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{formatDate(c.created_at)}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{c.patient_name || '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{c.professional_name || '—'}</td>
                  <td className="px-5 py-3 text-slate-600 max-w-xs truncate">{c.diagnosis || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => navigate(`/dashboard/pacientes/${c.patient_id}`)}
                      className="text-xs text-indigo-600 hover:underline font-medium"
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
