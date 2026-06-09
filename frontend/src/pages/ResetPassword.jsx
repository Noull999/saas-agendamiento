import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), password });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al restablecer contraseña');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white text-sm shadow-lg shadow-red-500/30">📅</div>
          <span className="font-bold text-white">AgendaSaaS</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Nueva contraseña</h2>
        <p className="text-zinc-500 text-sm mb-8">Elige una contraseña de al menos 8 caracteres.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nueva contraseña</label>
            <input
              type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirmar contraseña</label>
            <input
              type="password" required minLength={8} value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          <button
            type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:from-red-600 hover:to-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/20"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 mt-6">
          <Link to="/login" className="text-red-400 hover:text-red-300 hover:underline font-medium transition-colors">Volver al login</Link>
        </p>
      </div>
    </div>
  );
}
