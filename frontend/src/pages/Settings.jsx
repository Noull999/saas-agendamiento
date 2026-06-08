import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { VERTICALS } from '../config/verticals.config';

const PLAN_ORDER = ['basic', 'pro', 'business'];
const PLAN_BADGE = {
  basic: 'bg-slate-100 text-slate-600',
  pro: 'bg-indigo-100 text-indigo-700',
  business: 'bg-violet-100 text-violet-700',
};
const PLAN_BORDER = {
  basic: 'border-slate-200',
  pro: 'border-indigo-400',
  business: 'border-violet-400',
};

export default function Settings() {
  const { business, updateBusiness } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', description: '', vertical: 'salud' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState([]);
  const [upgrading, setUpgrading] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/settings'),
      api.get('/billing/plans'),
    ]).then(([settingsRes, plansRes]) => {
      const data = settingsRes.data;
      setForm({
        name: data.name || '',
        phone: data.phone || '',
        description: data.description || '',
        vertical: data.vertical || 'salud',
      });
      setPlans(plansRes.data.plans || []);
      setLoading(false);
    });
  }, []);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setSaved(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/settings', form);
      updateBusiness({ name: data.name, vertical: data.vertical });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async (planId) => {
    setUpgrading(planId);
    try {
      const { data } = await api.post('/billing/checkout', { plan: planId });
      window.location.href = data.url;
    } catch (err) {
      alert(err.response?.data?.error || 'Error al iniciar el pago');
    } finally {
      setUpgrading(null);
    }
  };

  const inputClass = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  if (loading) return <p className="text-slate-400 text-sm">Cargando...</p>;

  const currentPlanIdx = PLAN_ORDER.indexOf(business?.plan || 'basic');

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-slate-500 text-sm mt-0.5">Gestiona tu cuenta y plan</p>
      </div>

      {/* Plans section */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Tu Plan</h2>
        <div className="grid grid-cols-1 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === (business?.plan || 'basic');
            const planIdx = PLAN_ORDER.indexOf(plan.id);
            const isUpgrade = planIdx > currentPlanIdx;
            const isDowngrade = planIdx < currentPlanIdx;

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border-2 p-5 transition-all ${
                  isCurrent
                    ? `${PLAN_BORDER[plan.id]} bg-white shadow-md`
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900">{plan.name}</h3>
                      {isCurrent && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_BADGE[plan.id]}`}>
                          Plan actual
                        </span>
                      )}
                      {plan.highlight && !isCurrent && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                      ${plan.price?.toLocaleString('es-CL')}
                      <span className="text-sm font-normal text-slate-400"> CLP/mes</span>
                    </p>
                    <ul className="mt-3 space-y-1">
                      {plan.features?.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="text-emerald-500 shrink-0">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0 pt-1">
                    {isCurrent ? (
                      <span className="text-sm text-slate-400 font-medium">Activo</span>
                    ) : isUpgrade ? (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgrading === plan.id}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
                      >
                        {upgrading === plan.id ? 'Redirigiendo...' : 'Subir →'}
                      </button>
                    ) : isDowngrade ? (
                      <span className="text-xs text-slate-400">Plan inferior</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Profile form */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Datos del negocio</h2>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre del negocio *</label>
            <input name="name" value={form.name} onChange={handleChange} required className={inputClass} placeholder="Ej: Barbería Don José" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Teléfono de contacto</label>
            <input name="phone" value={form.phone} onChange={handleChange} className={inputClass} placeholder="+56 9 1234 5678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} placeholder="Describe tu negocio..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de negocio</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.values(VERTICALS).map(v => (
                <button
                  key={v.id} type="button"
                  onClick={() => { setForm(f => ({ ...f, vertical: v.id })); setSaved(false); }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all ${
                    form.vertical === v.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl">{v.icon}</span>
                  <p className={`text-xs font-semibold leading-tight ${form.vertical === v.id ? 'text-indigo-700' : 'text-slate-700'}`}>{v.label}</p>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex items-center gap-4 pt-1">
            <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-colors">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saved && <span className="text-emerald-600 text-sm font-medium">✓ Guardado</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
