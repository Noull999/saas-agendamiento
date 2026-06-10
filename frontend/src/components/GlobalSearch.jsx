import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Ctrl+K to open / Escape to close
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Debounced search — 300 ms
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/bookings?search=${encodeURIComponent(query)}&limit=8`);
        setResults(res.data.bookings || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (booking) => {
    setOpen(false);
    navigate(`/dashboard?date=${booking.datetime_iso.slice(0, 10)}`);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar reservas y clientes..."
            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-sm"
          />
          <kbd className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-zinc-500">Buscando...</div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">Sin resultados</div>
          )}
          {!loading && !query.trim() && (
            <div className="px-4 py-3 text-sm text-zinc-500">Escribe para buscar reservas...</div>
          )}
          {results.map(b => (
            <button
              key={b.id}
              onClick={() => handleSelect(b)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold shrink-0">
                {(b.client_name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{b.client_name}</div>
                <div className="text-xs text-zinc-400 truncate">
                  {b.service_name || 'Sin servicio'} · {b.datetime_iso.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                b.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                b.status === 'pending'   ? 'bg-amber-500/20 text-amber-400' :
                                           'bg-zinc-700 text-zinc-400'
              }`}>
                {b.status === 'confirmed' ? 'Confirmada' :
                 b.status === 'pending'   ? 'Pendiente'  : b.status}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
