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

  const inputClass = 'w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white';

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col items-center justify-center p-12 text-white">
        <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-3xl mb-6">
          {selectedVertical ? selectedVertical.icon : '📅'}
        </div>
        <h1 className="text-3xl font-bold mb-3">AgendaSaaS</h1>
        <p className="text-slate-400 text-center max-w-xs">
          {selectedVertical
            ? selectedVertical.description
            : 'Comienza gratis y empieza a recibir reservas en minutos.'}
        </p>
        <div className="mt-12 space-y-4 w-full max-w-xs">
          {['Setup en menos de 5 minutos', 'Página de reservas personalizada', 'Sin comisiones por reserva'].map(f => (
            <div key={f} className="flex items-center gap-3 text-sm text-slate-300">
              <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-xs">✓</div>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm">📅</div>
            <span className="font-bold text-slate-900">AgendaSaaS</span>
          </div>

          {/* Step 1: Vertical selection */}
          {!selectedVertical && (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">¿Qué tipo de negocio tienes?</h2>
              <p className="text-slate-500 text-sm mb-8">Elige tu industria para personalizar tu cuenta</p>
              <div className="space-y-3">
                {VERTICAL_LIST.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => pickVertical(v)}
                    className="w-full text-left p-5 border-2 border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 group-hover:bg-indigo-100 rounded-xl flex items-center justify-center text-2xl transition-colors shrink-0">
                        {v.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{v.label}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{v.description}</p>
                      </div>
                      <div className="ml-auto text-slate-300 group-hover:text-indigo-400 transition-colors">→</div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-slate-500 mt-6">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-indigo-600 hover:underline font-medium">Inicia sesión</Link>
              </p>
            </>
          )}

          {/* Step 2: Registration form */}
          {selectedVertical && (
            <>
              <button
                onClick={() => setSelectedVertical(null)}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors"
              >
                ← Cambiar industria
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl">{selectedVertical.icon}</div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Crea tu cuenta</h2>
                  <p className="text-slate-400 text-xs">{selectedVertical.label}</p>
                </div>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre del negocio</label>
                  <input
                    name="name" required value={form.name} onChange={handle}
                    className={inputClass}
                    placeholder={selectedVertical.id === 'salud' ? 'Ej: Kinesiología López' : 'Ej: Salón Valentina'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de establecimiento</label>
                  <select name="specialty" value={form.specialty} onChange={handle} className={inputClass}>
                    {selectedVertical.specialties.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    name="owner_email" type="email" required value={form.owner_email} onChange={handle}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
                  <input
                    name="password" type="password" required minLength={8} value={form.password} onChange={handle}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Teléfono <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    name="phone" value={form.phone} onChange={handle}
                    className={inputClass}
                    placeholder="+56 9 1234 5678"
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
                  {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
                </button>

                <p className="text-center text-xs text-slate-400 leading-relaxed">
                  Al crear tu cuenta aceptas los{' '}
                  <Link to="/terminos" className="text-slate-500 hover:underline">Términos de servicio</Link>{' '}
                  y la{' '}
                  <Link to="/privacidad" className="text-slate-500 hover:underline">Política de privacidad</Link>.
                </p>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-indigo-600 hover:underline font-medium">Inicia sesión</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
