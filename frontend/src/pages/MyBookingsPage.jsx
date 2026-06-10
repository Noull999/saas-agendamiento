import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function formatDatetime(iso) {
  const d    = new Date(iso);
  const day  = DAYS_ES[d.getDay()];
  const date = d.getDate();
  const mon  = MONTHS_ES[d.getMonth()];
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${date} ${mon} · ${time} hrs`;
}

const STATUS = {
  confirmed: { label: 'Confirmada', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  completed: { label: 'Completada', color: 'bg-zinc-800 text-zinc-400 border border-zinc-700' },
  no_show:   { label: 'No asistió', color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
};

export default function MyBookingsPage() {
  const { slug } = useParams();
  const [phone,    setPhone]    = useState('');
  const [result,   setResult]   = useState(null);  // { business, bookings }
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [searched, setSearched] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`/api/public/${slug}/mis-citas`, { params: { phone: phone.trim() } });
      setResult(data);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al buscar tus citas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-start py-12 px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-red-500/20 border border-red-500/40 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">📅</div>
          <h1 className="text-2xl font-bold text-white">Mis citas</h1>
          <p className="text-zinc-500 text-sm mt-1">Consulta tus próximas reservas</p>
        </div>

        {/* Search form */}
        <form onSubmit={search} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 mb-6">
          <label className="block text-xs font-semibold text-zinc-300 mb-2">
            Número de teléfono WhatsApp
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+56 9 1234 5678"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '…' : 'Buscar'}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          <p className="text-zinc-500 text-xs mt-2">
            Ingresa el mismo número con el que hiciste la reserva.
          </p>
        </form>

        {/* Results */}
        {searched && result && (
          <div>
            {result.bookings.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-10 text-center">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-zinc-400 text-sm">No tienes citas próximas en <strong className="text-white">{result.business.name}</strong>.</p>
                <Link
                  to={`/book/${slug}`}
                  className="inline-block mt-4 text-sm text-red-400 hover:text-red-300 hover:underline"
                >
                  Agendar una cita →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide px-1">
                  {result.bookings.length} cita{result.bookings.length !== 1 ? 's' : ''} próxima{result.bookings.length !== 1 ? 's' : ''} en {result.business.name}
                </p>
                {result.bookings.map(b => (
                  <div key={b.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm capitalize">
                          {formatDatetime(b.datetime_iso)}
                        </p>
                        {b.service_name && (
                          <p className="text-zinc-500 text-xs mt-0.5">{b.service_name}</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS[b.status]?.color || 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                        {STATUS[b.status]?.label || b.status}
                      </span>
                    </div>
                    {b.cancel_token && b.status === 'confirmed' && (
                      <div className="mt-3 pt-3 border-t border-zinc-800">
                        <Link
                          to={`/cancel/${b.cancel_token}`}
                          className="text-xs text-red-400 hover:text-red-300 hover:underline"
                        >
                          Cancelar esta cita
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-center pt-2">
                  <Link
                    to={`/book/${slug}`}
                    className="text-sm text-red-400 hover:text-red-300 hover:underline"
                  >
                    + Agendar nueva cita
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
