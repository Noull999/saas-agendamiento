import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../api/client';
import { Section, Container } from '../components/ui/Section';
import { StatCard, StatsGrid } from '../components/ui/StatCard';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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
    <div className="min-h-screen bg-gray-50">
      <Section gradient className="mb-0">
        <Container>
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">📊 Analytics</h1>
              <p className="text-gray-600">Estadísticas de tu negocio</p>
            </div>
            <select
              value={range} onChange={(e) => setRange(e.target.value)}
              className="border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
            </select>
          </div>
        </Container>
      </Section>

      <Container className="py-12">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && data && (
          <>
            <StatsGrid>
              <StatCard label="Total reservas" value={data.totals.total.toString()} icon="📅" color="blue" />
              <StatCard label="Confirmadas" value={data.totals.confirmed.toString()} icon="✅" color="green" />
              <StatCard label="Completadas" value={data.totals.completed.toString()} icon="✓" color="purple" />
            </StatsGrid>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-6">📈 Reservas por día</h2>
                {data.byDay.length === 0 ? (
                  <p className="text-gray-500 text-center py-12">Sin datos en este período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.byDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip
                        labelFormatter={(v) => `Día: ${formatDay(v)}`}
                        formatter={(v) => [v, 'Reservas']}
                        contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-6">🎯 Top servicios</h2>
                {pieData.length === 0 ? (
                  <p className="text-gray-500 text-center py-12">Sin datos en este período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
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
      </Container>
    </div>
  );
}
