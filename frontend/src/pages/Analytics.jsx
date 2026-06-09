import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../api/client';

const COLORS = ['#ef4444', '#f97316', '#a855f7', '#10b981', '#f59e0b'];

const DARK_TOOLTIP = {
  contentStyle: { background: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', color: '#fff' },
  labelStyle: { color: '#a1a1aa' },
};

function StatCard({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-5 shadow-md shadow-black/20 border border-zinc-800">
      <p className="text-sm text-zinc-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function RevenueCard({ value, prevRevenue }) {
  const [visible, setVisible] = useState(false);
  const formatted = typeof value === 'number'
    ? `$${value.toLocaleString('es-CL')}`
    : '—';

  const pct = (typeof value === 'number' && typeof prevRevenue === 'number' && prevRevenue > 0)
    ? (((value - prevRevenue) / prevRevenue) * 100).toFixed(1)
    : null;

  return (
    <div className="bg-zinc-900 rounded-2xl p-5 shadow-md shadow-black/20 border border-zinc-800 col-span-2 md:col-span-1">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-zinc-400">Ingresos del período</p>
        <button
          onClick={() => setVisible(v => !v)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
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
        className={`text-3xl font-bold text-emerald-400 transition-all duration-300 select-none ${
          visible ? '' : 'blur-sm'
        }`}
      >
        {formatted}
      </p>
      {!visible && (
        <p className="text-xs text-zinc-500 mt-1">Haz clic en el ojo para ver</p>
      )}
      {pct !== null && (
        <p className={`text-xs mt-2 font-medium ${Number(pct) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {Number(pct) >= 0 ? `+${pct}%` : `${pct}%`} vs período anterior
        </p>
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
  const peakHours = data?.peakHours || [];
  const newClients = data?.newVsReturning?.new_clients ?? 0;
  const returningClients = data?.newVsReturning?.returning_clients ?? 0;
  const cancellationRate = data?.cancellationRate ?? null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Estadísticas de tu negocio</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={range} onChange={(e) => setRange(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-2 text-sm shadow-md shadow-black/20 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
          </select>
          <button
            onClick={() => {
              const from = new Date(Date.now() - (Number(range) - 1) * 86400000).toISOString().slice(0, 10);
              const to = new Date().toISOString().slice(0, 10);
              window.open(`/api/reports/bookings?from=${from}&to=${to}`, '_blank');
            }}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-black/20"
          >
            📄 Descargar PDF
          </button>
        </div>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Cargando...</p>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total reservas"  value={data.totals.total} />
            <StatCard label="Confirmadas"     value={data.totals.confirmed} color="text-red-400" />
            <StatCard label="Completadas"     value={data.totals.completed} color="text-emerald-400" />
            <StatCard label="Canceladas"      value={data.totals.cancelled} color="text-red-500" />
            <RevenueCard value={data.revenue} prevRevenue={data.prevRevenue} />
            {cancellationRate !== null && (
              <div className="bg-zinc-900 rounded-2xl p-5 shadow-md shadow-black/20 border border-zinc-800">
                <p className="text-sm text-zinc-400 mb-1">Tasa de cancelación</p>
                <p className="text-3xl font-bold text-amber-400">{Number(cancellationRate).toFixed(1)}%</p>
              </div>
            )}
            {(newClients > 0 || returningClients > 0) && (
              <>
                <div className="bg-zinc-900 rounded-2xl p-5 shadow-md shadow-black/20 border border-zinc-800">
                  <p className="text-sm text-zinc-400 mb-1">Clientes nuevos</p>
                  <p className="text-3xl font-bold text-violet-400">{newClients}</p>
                </div>
                <div className="bg-zinc-900 rounded-2xl p-5 shadow-md shadow-black/20 border border-zinc-800">
                  <p className="text-sm text-zinc-400 mb-1">Clientes recurrentes</p>
                  <p className="text-3xl font-bold text-blue-400">{returningClients}</p>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-md shadow-black/20 p-6">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Reservas por día</h2>
              {data.byDay.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">Sin datos en este período</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.byDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fill: '#71717a', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(v) => `Día: ${formatDay(v)}`}
                      formatter={(v) => [v, 'Reservas']}
                      {...DARK_TOOLTIP}
                    />
                    <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-md shadow-black/20 p-6">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Top servicios</h2>
              {pieData.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">Sin datos en este período</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={{ stroke: '#71717a' }}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }} />
                    <Tooltip {...DARK_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {peakHours.length > 0 && (
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-md shadow-black/20 p-6 md:col-span-2">
                <h2 className="text-sm font-semibold text-zinc-300 mb-4">Horas pico</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={peakHours} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="hour" tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
                    <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(h) => `${h}:00`}
                      formatter={(v) => [v, 'Reservas']}
                      {...DARK_TOOLTIP}
                    />
                    <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
