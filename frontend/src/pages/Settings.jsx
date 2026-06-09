import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { VERTICALS } from '../config/verticals.config';
import { useToast } from '../context/ToastContext';

const PLAN_ORDER = ['basic', 'pro', 'business'];
const PLAN_BADGE = {
  basic: 'bg-zinc-700 text-zinc-300',
  pro: 'bg-red-500/20 text-red-400',
  business: 'bg-violet-500/20 text-violet-400',
};
const PLAN_BORDER = {
  basic: 'border-zinc-700',
  pro: 'border-red-500',
  business: 'border-violet-500',
};

export default function Settings() {
  const { business, updateBusiness } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '', description: '', vertical: 'salud' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState([]);
  const [upgrading, setUpgrading] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(null);
  const [mpToken, setMpToken] = useState('');
  const [mpEnabled, setMpEnabled] = useState(false);
  const [mpTokenConfigured, setMpTokenConfigured] = useState(false);
  const [savingMp, setSavingMp] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/settings'),
      api.get('/billing/plans'),
      api.get('/settings/templates'),
      api.get('/payments/settings').catch(() => ({ data: {} })),
    ]).then(([settingsRes, plansRes, templatesRes, mpSettingsRes]) => {
      const data = settingsRes.data;
      setForm({
        name: data.name || '',
        phone: data.phone || '',
        description: data.description || '',
        vertical: data.vertical || 'salud',
      });
      setPlans(plansRes.data.plans || []);
      setTemplates(templatesRes.data);
      setMpEnabled(mpSettingsRes.data.mp_enabled || false);
      setMpTokenConfigured(mpSettingsRes.data.mp_token_configured || false);
      setLoading(false);
    }).catch(() => setLoading(false));

    api.get('/integrations/google/status')
      .then(({ data }) => setGoogleConnected(!!data.connected))
      .catch(() => {});

    api.get('/api-keys')
      .then(({ data }) => setApiKeys(data))
      .catch(() => {});

    // Mostrar feedback tras volver del flujo OAuth de Google
    const params = new URLSearchParams(window.location.search);
    const g = params.get('google');
    if (g === 'connected') {
      setGoogleConnected(true);
      toast.success('Google Calendar conectado');
    } else if (g === 'error') {
      toast.error('No se pudo conectar Google Calendar');
    }
    if (g) {
      params.delete('google');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  const connectGoogleCalendar = async () => {
    setGoogleLoading(true);
    try {
      const { data } = await api.get('/integrations/google/auth');
      if (data.url) {
        window.location.href = data.url; // Redirige al consentimiento de Google
      } else {
        toast.error('Google Calendar no está configurado');
        setGoogleLoading(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error iniciando conexión con Google Calendar');
      setGoogleLoading(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    try {
      await api.post('/integrations/google/disconnect');
      setGoogleConnected(false);
      toast.success('Google Calendar desconectado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error desconectando');
    }
  };

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
      toast.error(err.response?.data?.error || 'Error al iniciar el pago');
    } finally {
      setUpgrading(null);
    }
  };

  const saveTemplate = async (type, channel, content) => {
    const key = `${type}:${channel}`;
    setSavingTemplate(key);
    try {
      await api.put('/settings/templates', { type, channel, content });
      toast.success('Template guardado');
      setTemplates(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          [channel]: { content, customized: true },
        },
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando template');
    } finally {
      setSavingTemplate(null);
    }
  };

  const saveMpSettings = async () => {
    setSavingMp(true);
    try {
      await api.post('/payments/settings', {
        mp_access_token: mpToken || undefined,
        mp_enabled: mpEnabled,
      });
      if (mpToken) setMpTokenConfigured(true);
      setMpToken(''); // clear after save — don't keep token in state
      toast.success('Configuración de Mercado Pago guardada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando configuración');
    } finally {
      setSavingMp(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { toast.error('Nombre de la key requerido'); return; }
    setCreatingKey(true);
    try {
      const { data } = await api.post('/api-keys', { name: newKeyName.trim() });
      setCreatedKey(data);
      setNewKeyName('');
      setShowNewKeyForm(false);
      // Refresh the list
      const { data: keys } = await api.get('/api-keys');
      setApiKeys(keys);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!window.confirm('¿Revocar esta API key? Dejará de funcionar de inmediato.')) return;
    try {
      await api.delete(`/api-keys/${id}`);
      setApiKeys(prev => prev.filter(k => k.id !== id));
      toast.success('API key revocada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error revocando API key');
    }
  };

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';

  if (loading) return <p className="text-zinc-500 text-sm">Cargando...</p>;

  const currentPlanIdx = PLAN_ORDER.indexOf(business?.plan || 'basic');

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Gestiona tu cuenta y plan</p>
      </div>

      {/* Plans section */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Tu Plan</h2>
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
                    ? `${PLAN_BORDER[plan.id]} bg-red-500/5 shadow-md shadow-red-500/10`
                    : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white">{plan.name}</h3>
                      {isCurrent && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_BADGE[plan.id]}`}>
                          Plan actual
                        </span>
                      )}
                      {plan.highlight && !isCurrent && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-white">
                      ${plan.price?.toLocaleString('es-CL')}
                      <span className="text-sm font-normal text-zinc-500"> CLP/mes</span>
                    </p>
                    <ul className="mt-3 space-y-1">
                      {plan.features?.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                          <span className="text-emerald-400 shrink-0">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0 pt-1">
                    {isCurrent ? (
                      <span className="text-sm text-zinc-500 font-medium">Activo</span>
                    ) : isUpgrade ? (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgrading === plan.id}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
                      >
                        {upgrading === plan.id ? 'Redirigiendo...' : 'Subir →'}
                      </button>
                    ) : isDowngrade ? (
                      <span className="text-xs text-zinc-500">Plan inferior</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Message Templates */}
      {templates && (
        <div>
          <h2 className="text-base font-semibold text-white mb-1">Templates de mensajes automáticos</h2>
          <p className="text-zinc-500 text-xs mb-4">Personaliza los mensajes que reciben tus clientes. Guarda con Tab o al salir del campo.</p>
          <div className="space-y-6">
            {[
              { key: 'booking_confirmation', label: 'Confirmación de reserva' },
              { key: 'reminder', label: 'Recordatorio 24h antes' },
              { key: 'cancellation', label: 'Cancelación de reserva' },
            ].map(({ key, label }) => (
              templates[key] && (
                <div key={key} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">
                  <h3 className="text-white font-medium text-sm">{label}</h3>
                  {[
                    { channel: 'whatsapp', label: 'Mensaje WhatsApp', multiline: true },
                    { channel: 'email_subject', label: 'Asunto del email', multiline: false },
                    { channel: 'email_body', label: 'Cuerpo del email (HTML)', multiline: true },
                  ].map(({ channel, label: chLabel, multiline }) => {
                    const saving = savingTemplate === `${key}:${channel}`;
                    return (
                      <div key={channel}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-zinc-400">{chLabel}</label>
                          {templates[key][channel]?.customized && (
                            <span className="text-xs text-emerald-500">Personalizado</span>
                          )}
                          {saving && <span className="text-xs text-zinc-500">Guardando...</span>}
                        </div>
                        {multiline ? (
                          <textarea
                            key={`${key}-${channel}-${templates[key][channel]?.content?.slice(0, 10)}`}
                            defaultValue={templates[key][channel]?.content || ''}
                            onBlur={e => {
                              const val = e.target.value;
                              if (val !== templates[key][channel]?.content) saveTemplate(key, channel, val);
                            }}
                            rows={channel === 'email_body' ? 5 : 4}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono resize-y"
                          />
                        ) : (
                          <input
                            key={`${key}-${channel}-${templates[key][channel]?.content?.slice(0, 10)}`}
                            type="text"
                            defaultValue={templates[key][channel]?.content || ''}
                            onBlur={e => {
                              const val = e.target.value;
                              if (val !== templates[key][channel]?.content) saveTemplate(key, channel, val);
                            }}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-zinc-600">
                    Variables disponibles: <span className="font-mono text-zinc-500">{'{{clientName}} {{businessName}} {{serviceName}} {{date}} {{time}} {{cancelLink}}'}</span>
                  </p>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Mercado Pago */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Mercado Pago</h2>
        <p className="text-zinc-500 text-xs mb-4">
          Permite que tus clientes paguen al momento de reservar. Requiere una cuenta de Mercado Pago.{' '}
          <a
            href="https://www.mercadopago.cl/developers/es/docs/getting-started/create-account"
            target="_blank"
            rel="noreferrer"
            className="text-red-400 hover:text-red-300 underline"
          >
            Cómo obtener tu Access Token
          </a>
        </p>
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-5">
          {mpTokenConfigured && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
              <span className="text-emerald-400 text-sm">✓ Access Token configurado</span>
              <span className="text-zinc-500 text-xs ml-auto">Para actualizar, ingresa uno nuevo</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Access Token {mpTokenConfigured ? '(dejar vacío para mantener el actual)' : ''}
            </label>
            <input
              type="password"
              value={mpToken}
              onChange={e => setMpToken(e.target.value)}
              placeholder={mpTokenConfigured ? '••••••••••••••••••••••••' : 'APP_USR-... o TEST-...'}
              className={inputClass}
            />
            <p className="text-xs text-zinc-500 mt-1">
              Usa tokens que empiezan con <code className="text-zinc-400">TEST-</code> para sandbox y <code className="text-zinc-400">APP_USR-</code> para producción.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="mpEnabled"
              checked={mpEnabled}
              onChange={e => setMpEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 accent-red-500"
            />
            <label htmlFor="mpEnabled" className="text-sm text-white cursor-pointer">
              Habilitar opción de pago previo al reservar
            </label>
          </div>
          <button
            onClick={saveMpSettings}
            disabled={savingMp}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
          >
            {savingMp ? 'Guardando...' : 'Guardar configuración MP'}
          </button>
        </div>
      </div>

      {/* Google Calendar */}
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Google Calendar</h2>
        <p className="text-zinc-500 text-xs mb-4">
          Sincroniza automáticamente tus reservas con tu Google Calendar. Cuando se crea una reserva se agrega un evento, y al cancelarla se elimina.
        </p>
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
          {!googleConnected ? (
            <button
              onClick={connectGoogleCalendar}
              disabled={googleLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
            >
              {googleLoading ? 'Conectando...' : 'Conectar Google Calendar'}
            </button>
          ) : (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span className="text-white text-sm font-medium">Google Calendar conectado</span>
              </div>
              <button
                onClick={disconnectGoogleCalendar}
                className="text-red-400 hover:text-red-300 text-xs font-medium"
              >
                Desconectar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* API Keys */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-white">API Keys</h2>
          {!showNewKeyForm && (
            <button
              onClick={() => setShowNewKeyForm(true)}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              + Nueva key
            </button>
          )}
        </div>
        <p className="text-zinc-500 text-xs mb-4">
          Integra tu agendamiento con apps externas o CRMs usando la API.{' '}
          Autentica cada request con el header <code className="text-zinc-400">X-API-Key</code>.
        </p>

        {createdKey && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-emerald-400 text-sm font-medium mb-2">API key creada exitosamente</p>
            <p className="text-zinc-300 text-xs font-mono break-all mb-2 select-all">{createdKey.key}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { navigator.clipboard.writeText(createdKey.key); toast.success('Copiado al portapapeles'); }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Copiar key
              </button>
              <button
                onClick={() => setCreatedKey(null)}
                className="text-xs text-zinc-500 hover:text-zinc-400"
              >
                Cerrar
              </button>
            </div>
            <p className="text-zinc-500 text-xs mt-2">Esta es la única vez que puedes ver la key. Guárdala ahora.</p>
          </div>
        )}

        {showNewKeyForm && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-4 mb-4 space-y-3">
            <input
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
              placeholder="Ej: App móvil, Integración CRM"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateKey}
                disabled={creatingKey || !newKeyName.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {creatingKey ? 'Creando...' : 'Crear key'}
              </button>
              <button
                onClick={() => { setShowNewKeyForm(false); setNewKeyName(''); }}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {apiKeys.map(k => (
            <div key={k.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div>
                <p className="text-white text-sm font-medium">{k.name}</p>
                <p className="text-zinc-500 text-xs font-mono">{k.key_prefix}••••••••</p>
                {k.last_used && (
                  <p className="text-zinc-600 text-xs">
                    Último uso: {new Date(k.last_used).toLocaleDateString('es-CL')}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleRevokeKey(k.id)}
                className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors ml-4 shrink-0"
              >
                Revocar
              </button>
            </div>
          ))}
          {apiKeys.length === 0 && !showNewKeyForm && (
            <p className="text-zinc-500 text-sm text-center py-4">Sin API keys generadas</p>
          )}
        </div>
      </div>

      {/* Profile form */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Datos del negocio</h2>
        <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-md shadow-black/20 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nombre del negocio *</label>
            <input name="name" value={form.name} onChange={handleChange} required className={inputClass} placeholder="Ej: Barbería Don José" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Teléfono de contacto</label>
            <input name="phone" value={form.phone} onChange={handleChange} className={inputClass} placeholder="+56 9 1234 5678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Descripción</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={`${inputClass} resize-none`} placeholder="Describe tu negocio..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Tipo de negocio</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.values(VERTICALS).map(v => (
                <button
                  key={v.id} type="button"
                  onClick={() => { setForm(f => ({ ...f, vertical: v.id })); setSaved(false); }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all ${
                    form.vertical === v.id
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-2xl">{v.icon}</span>
                  <p className={`text-xs font-semibold leading-tight ${form.vertical === v.id ? 'text-red-400' : 'text-zinc-300'}`}>{v.label}</p>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex items-center gap-4 pt-1">
            <button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-colors">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saved && <span className="text-emerald-400 text-sm font-medium">✓ Guardado</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
