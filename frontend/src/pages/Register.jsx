import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VERTICALS } from '../config/verticals.config';

const VERTICAL_LIST = Object.values(VERTICALS);

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [selectedVertical, setSelectedVertical] = useState(null);
  const [form, setForm] = useState({ name: '', owner_email: '', password: '', phone: '', specialty: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const pickVertical = (v) => {
    setSelectedVertical(v);
    setForm((f) => ({ ...f, specialty: v.specialties[0].value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form.name, form.owner_email, form.password, form.phone, form.specialty, selectedVertical.id);
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';

  return (
    <div className="min-h-screen flex bg-black">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex-col items-center justify-center p-12 text-white border-r border-zinc-800">
        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-2xl shadow-red-500/30">
          {selectedVertical ? selectedVertical.icon : '📅'}
        </div>
        <h1 className="text-4xl font-bold mb-3 tracking-tight">AgendaSaaS</h1>
        <p className="text-zinc-400 text-center max-w-xs">
          {selectedVertical
            ? selectedVertical.description
            : 'Comienza gratis y empieza a recibir reservas en minutos.'}
        </p>
        <div className="mt-12 space-y-4 w-full max-w-xs">
          {['Setup en menos de 5 minutos', 'Página de reservas personalizada', 'Sin comisiones por reserva'].map(f => (
            <div key={f} className="flex items-center gap-3 text-sm text-zinc-300">
              <div className="w-5 h-5 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center text-xs text-red-400">✓</div>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-black">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white text-sm shadow-lg shadow-red-500/30">📅</div>
            <span className="font-bold text-white">AgendaSaaS</span>
          </div>

          {/* Step 1: Vertical selection */}
          {!selectedVertical && (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">¿Qué tipo de negocio tienes?</h2>
              <p className="text-zinc-500 text-sm mb-8">Elige tu industria para personalizar tu cuenta</p>
              <div className="space-y-3">
                {VERTICAL_LIST.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => pickVertical(v)}
                    className="w-full text-left p-5 bg-zinc-900 border-2 border-zinc-800 rounded-2xl hover:border-red-500 hover:bg-zinc-900/70 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-800 group-hover:bg-red-500/20 rounded-xl flex items-center justify-center text-2xl transition-colors shrink-0">
                        {v.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-white group-hover:text-red-400 transition-colors">{v.label}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{v.description}</p>
                      </div>
                      <div className="ml-auto text-zinc-700 group-hover:text-red-400 transition-colors">→</div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-zinc-500 mt-6">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-red-400 hover:text-red-300 hover:underline font-medium transition-colors">Inicia sesión</Link>
              </p>
            </>
          )}

          {/* Step 2: Registration form */}
          {selectedVertical && (
            <>
              <button
                onClick={() => setSelectedVertical(null)}
                className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-6 transition-colors"
              >
                ← Cambiar industria
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center justify-center text-xl">{selectedVertical.icon}</div>
                <div>
                  <h2 className="text-xl font-bold text-white">Crea tu cuenta</h2>
                  <p className="text-zinc-500 text-xs">{selectedVertical.label}</p>
                </div>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nombre del negocio</label>
                  <input
                    name="name" required value={form.name} onChange={handle}
                    className={inputClass}
                    placeholder={selectedVertical.id === 'salud' ? 'Ej: Kinesiología López' : 'Ej: Salón Valentina'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tipo de establecimiento</label>
                  <select name="specialty" value={form.specialty} onChange={handle} className={inputClass}>
                    {selectedVertical.specialties.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
                  <input
                    name="owner_email" type="email" required value={form.owner_email} onChange={handle}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Contraseña</label>
                  <input
                    name="password" type="password" required minLength={8} value={form.password} onChange={handle}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Teléfono <span className="text-zinc-500 font-normal">(opcional)</span>
                  </label>
                  <input
                    name="phone" value={form.phone} onChange={handle}
                    className={inputClass}
                    placeholder="+56 9 1234 5678"
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
                  {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
                </button>

                <p className="text-center text-xs text-zinc-600 leading-relaxed">
                  Al crear tu cuenta aceptas los{' '}
                  <Link to="/terminos" className="text-zinc-400 hover:text-white hover:underline transition-colors">Términos de servicio</Link>{' '}
                  y la{' '}
                  <Link to="/privacidad" className="text-zinc-400 hover:text-white hover:underline transition-colors">Política de privacidad</Link>.
                </p>
              </form>

              <p className="text-center text-sm text-zinc-500 mt-6">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-red-400 hover:text-red-300 hover:underline font-medium transition-colors">Inicia sesión</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
