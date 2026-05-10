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
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col items-center justify-center p-12 text-white">
        <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-3xl mb-6">📅</div>
        <h1 className="text-3xl font-bold mb-3">AgendaSaaS</h1>
        <p className="text-slate-400 text-center max-w-xs">
          Gestiona tus reservas, servicios y horarios desde un solo lugar.
        </p>
        <div className="mt-12 space-y-4 w-full max-w-xs">
          {['Reservas en línea 24/7', 'Notificaciones por WhatsApp', 'Panel de control completo'].map(f => (
            <div key={f} className="flex items-center gap-3 text-sm text-slate-300">
              <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-xs">✓</div>
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm">📅</div>
            <span className="font-bold text-slate-900">AgendaSaaS</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Bienvenido de vuelta</h2>
          <p className="text-slate-500 text-sm mb-8">Accede al panel de tu negocio</p>

          {location.state?.msg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-4">
              {location.state.msg}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                name="owner_email" type="email" required value={form.owner_email} onChange={handle}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Contraseña</label>
                <Link to="/forgot-password" className="text-xs text-indigo-600 hover:underline">¿Olvidaste tu contraseña?</Link>
              </div>
              <input
                name="password" type="password" required value={form.password} onChange={handle}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-indigo-600 hover:underline font-medium">Regístrate gratis</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
