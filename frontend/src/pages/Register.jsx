import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SPECIALTIES = [
  { value: 'general', label: 'General / Otro' },
  { value: 'kinesiologia', label: 'Kinesiología' },
  { value: 'psicologia', label: 'Psicología' },
  { value: 'nutricion', label: 'Nutrición' },
  { value: 'odontologia', label: 'Odontología' },
  { value: 'medicina', label: 'Medicina General' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', owner_email: '', password: '', phone: '', specialty: 'general' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form.name, form.owner_email, form.password, form.phone, form.specialty);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all';

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 flex-col items-center justify-center p-12 text-white">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl mb-8 backdrop-blur-lg">📅</div>
        <h1 className="text-5xl font-bold mb-4">AgendaSaaS</h1>
        <p className="text-blue-100 text-center max-w-xs text-lg mb-12">
          Comienza gratis y empieza a recibir reservas en minutos.
        </p>
        <div className="space-y-4 w-full max-w-xs">
          {['✓ Setup en menos de 5 minutos', '✓ Página de reservas personalizada', '✓ Sin comisiones por reserva'].map(f => (
            <div key={f} className="flex items-center gap-3 text-sm text-blue-100">
              <div className="w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center text-xs font-bold text-white">✓</div>
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white text-lg font-bold">📅</div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">AgendaSaaS</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Crea tu cuenta</h2>
          <p className="text-gray-600 text-sm mb-10">Empieza gratis, cancela cuando quieras</p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Nombre del negocio o consulta *</label>
              <input
                name="name" required value={form.name} onChange={handle}
                className={inputClass}
                placeholder="Ej: Kinesiología López"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Especialidad *</label>
              <select name="specialty" value={form.specialty} onChange={handle} className={inputClass}>
                {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Email *</label>
              <input
                name="owner_email" type="email" required value={form.owner_email} onChange={handle}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Contraseña *</label>
              <input
                name="password" type="password" required minLength={6} value={form.password} onChange={handle}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Teléfono <span className="text-gray-500 font-normal">(opcional)</span>
              </label>
              <input
                name="phone" value={form.phone} onChange={handle}
                className={inputClass}
                placeholder="+56 9 1234 5678"
              />
            </div>
            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 font-medium">
                ⚠️ {error}
              </div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg py-3 text-sm font-bold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all transform hover:scale-105 active:scale-95 shadow-lg mt-4"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creando cuenta...
                </span>
              ) : '🚀 Crear cuenta gratis'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-8">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-bold underline">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
