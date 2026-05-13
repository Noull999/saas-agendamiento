import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../api/client';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function StatCard({ label, value, color = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function RevenueCard({ value }) {
  const [visible, setVisible] = useState(false);
  const formatted = typeof value === 'number'
    ? `$${value.toLocaleString('es-CL')}`
    : '—';

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 col-span-2 md:col-span-1">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-slate-500">Ingresos del período</p>
        <button
          onClick={() => setVisible(v => !v)}
          className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
          title={visible ? 'Ocultar' : 'Mostrar ingresos'}
        >
          {visible ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      <p
        className={`text-3xl font-bold text-emerald-600 transition-all duration-300 select-none ${
          visible ? '' : 'blur-sm'
        }`}
      >
        {formatted}
      </p>
      {!visible && (
        <p className="text-xs text-slate-400 mt-1">Haz clic en el ojo para ver</p>
      )}
    </div>
  );
}

function formatDay(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30');

  const load = async (days) => {
    setLoading(true);
    const from = new Date(Date.now() - (Number(days) - 1) * 86400000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    try {
      const { data: res } = await api.get('/analytics', { params: { from, to } });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(range); }, [range]);

  const pieData = data?.byService?.map(s => ({ name: s.name, value: s.count })) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Estadísticas de tu negocio</p>
        </div>
        <select
          value={range} onChange={(e) => setRange(e.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
        </select>
      </div>

      {loading && <p className="text-slate-400 text-sm">Cargando...</p>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total reservas"  value={data.totals.total} />
            <StatCard label="Confirmadas"     value={data.totals.confirmed} color="text-indigo-600" />
            <StatCard label="Completadas"     value={data.totals.completed} color="text-emerald-600" />
            <StatCard label="Canceladas"      value={data.totals.cancelled} color="text-red-500" />
            <RevenueCard value={data.revenue} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Reservas por día</h2>
              {data.byDay.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Sin datos en este período</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.byDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(v) => `Día: ${formatDay(v)}`}
                      formatter={(v) => [v, 'Reservas']}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Top servicios</h2>
              {pieData.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Sin datos en este período</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
