import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ owner_email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.owner_email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-black">
      {/* Left panel: brand */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex-col items-center justify-center p-12 text-white border-r border-zinc-800">
        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-2xl shadow-red-500/30">📅</div>
        <h1 className="text-4xl font-bold mb-3 tracking-tight">AgendaSaaS</h1>
        <p className="text-zinc-400 text-center max-w-xs mb-12">
          Gestiona tus reservas, servicios y horarios desde un solo lugar.
        </p>
        <div className="space-y-4 w-full max-w-xs">
          {['Reservas en línea 24/7', 'Notificaciones por WhatsApp', 'Panel de control completo'].map(f => (
            <div key={f} className="flex items-center gap-3 text-sm text-zinc-300">
              <div className="w-5 h-5 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center text-xs text-red-400">✓</div>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-black">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white text-sm shadow-lg shadow-red-500/30">📅</div>
            <span className="font-bold text-white">AgendaSaaS</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Bienvenido de vuelta</h2>
          <p className="text-zinc-500 text-sm mb-8">Accede al panel de tu negocio</p>

          {location.state?.msg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl px-4 py-3 mb-4">
              {location.state.msg}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <input
                name="owner_email" type="email" required value={form.owner_email} onChange={handle}
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-zinc-300">Contraseña</label>
                <Link to="/forgot-password" className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors">¿Olvidaste tu contraseña?</Link>
              </div>
              <input
                name="password" type="password" required value={form.password} onChange={handle}
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:from-red-600 hover:to-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all mt-2 shadow-lg shadow-red-500/20"
            >
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-red-400 hover:text-red-300 hover:underline font-medium transition-colors">Regístrate gratis</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
