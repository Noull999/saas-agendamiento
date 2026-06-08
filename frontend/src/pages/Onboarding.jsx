import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getVertical } from '../config/verticals.config';

const DAYS = [
  { dow: 1, label: 'Lun' },
  { dow: 2, label: 'Mar' },
  { dow: 3, label: 'Mié' },
  { dow: 4, label: 'Jue' },
  { dow: 5, label: 'Vie' },
  { dow: 6, label: 'Sáb' },
  { dow: 0, label: 'Dom' },
];

// Bloques por defecto que se aplican a cada día activado (el negocio los afina luego en Horarios)
const DEFAULT_SLOTS = ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00'];

const inputClass =
  'mt-1.5 w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white';

export default function Onboarding() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const vertical = getVertical(business?.vertical);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Paso 1 — primer servicio
  const [service, setService] = useState({ name: '', duration_min: 60, price: '' });
  // Paso 2 — días laborales (Lun-Vie activos por defecto)
  const [activeDays, setActiveDays] = useState([1, 2, 3, 4, 5]);

  const publicUrl = business?.slug ? `${window.location.origin}/book/${business.slug}` : '';

  const toggleDay = (dow) =>
    setActiveDays((d) => (d.includes(dow) ? d.filter((x) => x !== dow) : [...d, dow]));

  // Paso 1 → crea el servicio y avanza
  const saveService = async () => {
    if (!service.name.trim()) {
      setError('Escribe el nombre de tu servicio.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/services', {
        name: service.name.trim(),
        duration_min: Number(service.duration_min) || 60,
        price: service.price ? Number(service.price) : null,
      });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el servicio.');
    } finally {
      setSaving(false);
    }
  };

  // Paso 2 → guarda horarios de los días activos y avanza
  const saveSchedules = async () => {
    if (activeDays.length === 0) {
      setError('Selecciona al menos un día de atención.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await Promise.all(
        DAYS.map(({ dow }) =>
          api.post('/schedules', { dow, slots: activeDays.includes(dow) ? DEFAULT_SLOTS : [] })
        )
      );
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron guardar los horarios.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible: el usuario puede copiar manualmente */
    }
  };

  const finish = () => navigate('/dashboard');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Cabecera */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">
            {vertical.icon}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">¡Bienvenido, {business?.name}!</h1>
          <p className="text-slate-500 text-sm mt-1">
            Configura lo básico en 3 pasos y empieza a recibir reservas.
          </p>
        </div>

        {/* Progreso */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 w-8 rounded-full transition-all ${
                n === step ? 'bg-indigo-600' : n < step ? 'bg-indigo-300' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {/* PASO 1 — Servicio */}
          {step === 1 && (
            <>
              <span className="text-xs font-semibold text-indigo-600">PASO 1 DE 3</span>
              <h2 className="text-lg font-bold text-slate-900 mt-1 mb-1">Crea tu primer servicio</h2>
              <p className="text-slate-500 text-sm mb-5">
                Lo que ofreces a tus clientes. Podrás agregar más después.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-700">Nombre del servicio *</label>
                  <input
                    autoFocus
                    value={service.name}
                    onChange={(e) => setService((s) => ({ ...s, name: e.target.value }))}
                    className={inputClass}
                    placeholder={vertical.id === 'salud' ? 'Ej: Consulta general' : vertical.id === 'belleza' ? 'Ej: Corte de cabello' : 'Ej: Sesión de 1 hora'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Duración (min)</label>
                    <input
                      type="number" min="5" step="5"
                      value={service.duration_min}
                      onChange={(e) => setService((s) => ({ ...s, duration_min: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Precio (CLP)</label>
                    <input
                      type="number" min="0"
                      value={service.price}
                      onChange={(e) => setService((s) => ({ ...s, price: e.target.value }))}
                      placeholder="Opcional"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

              <div className="flex items-center justify-between mt-6">
                <button onClick={finish} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  Omitir por ahora
                </button>
                <button
                  onClick={saveService}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
                >
                  {saving ? 'Guardando...' : 'Continuar →'}
                </button>
              </div>
            </>
          )}

          {/* PASO 2 — Horarios */}
          {step === 2 && (
            <>
              <span className="text-xs font-semibold text-indigo-600">PASO 2 DE 3</span>
              <h2 className="text-lg font-bold text-slate-900 mt-1 mb-1">¿Qué días atiendes?</h2>
              <p className="text-slate-500 text-sm mb-5">
                Aplicaremos un horario estándar (mañana y tarde) a los días que elijas. Podrás ajustar
                cada bloque luego en «Horarios».
              </p>

              <div className="flex flex-wrap gap-2">
                {DAYS.map(({ dow, label }) => {
                  const on = activeDays.includes(dow);
                  return (
                    <button
                      key={dow}
                      onClick={() => toggleDay(dow)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                        on
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

              <div className="flex items-center justify-between mt-6">
                <button onClick={() => { setStep(1); setError(''); }} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  ← Atrás
                </button>
                <button
                  onClick={saveSchedules}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
                >
                  {saving ? 'Guardando...' : 'Continuar →'}
                </button>
              </div>
            </>
          )}

          {/* PASO 3 — Link público */}
          {step === 3 && (
            <>
              <span className="text-xs font-semibold text-indigo-600">PASO 3 DE 3</span>
              <h2 className="text-lg font-bold text-slate-900 mt-1 mb-1">¡Todo listo! 🎉</h2>
              <p className="text-slate-500 text-sm mb-5">
                Comparte este enlace con tus clientes para que reserven contigo.
              </p>

              {publicUrl ? (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={publicUrl}
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 text-slate-700"
                  />
                  <button
                    onClick={copyLink}
                    className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    {copied ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">
                  Tu enlace estará disponible en la sección «Configuración».
                </p>
              )}

              {publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-3 text-sm text-indigo-600 hover:underline"
                >
                  Ver mi página de reservas ↗
                </a>
              )}

              <button
                onClick={finish}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                Ir a mi panel →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
