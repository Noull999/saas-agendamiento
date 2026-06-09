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

const TABS = [
  { id: 'perfil',         label: 'Mi negocio',    icon: '🏢' },
  { id: 'plan',           label: 'Plan',           icon: '💳' },
  { id: 'mensajes',       label: 'Mensajes',       icon: '💬' },
  { id: 'integraciones',  label: 'Integraciones',  icon: '🔌' },
  { id: 'avanzado',       label: 'Avanzado',       icon: '⚙️' },
];

export default function Settings() {
  const { business, updateBusiness } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('perfil');
  const [form, setForm] = useState({ name: '', phone: '', description: '', vertical: 'salud' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState([]);
  const [upgrading, setUpgrading] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(null);
  const [templatePreviews, setTemplatePreviews] = useState({});
  const [emailExpanded, setEmailExpanded] = useState({});
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

  const bookingUrl = business?.slug
    ? `${window.location.origin}/book/${business.slug.trim()}`
    : '';

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
      const tdata = templatesRes.data || {};
      setTemplates(tdata);
      // Initialize previews with current content
      const previews = {};
      for (const [type, channels] of Object.entries(tdata)) {
        previews[type] = {};
        for (const [ch, val] of Object.entries(channels || {})) {
          previews[type][ch] = val?.content || '';
        }
      }
      setTemplatePreviews(previews);
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

    const params = new URLSearchParams(window.location.search);
    const g = params.get('google');
    if (g === 'connected') {
      setGoogleConnected(true);
      setActiveTab('integraciones');
      toast.success('Google Calendar conectado correctamente');
    } else if (g === 'error') {
      setActiveTab('integraciones');
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
        window.location.href = data.url;
      } else {
        toast.error('Google Calendar no está configurado en el servidor');
        setGoogleLoading(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al iniciar conexión con Google');
      setGoogleLoading(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    try {
      await api.post('/integrations/google/disconnect');
      setGoogleConnected(false);
      toast.success('Google Calendar desconectado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al desconectar');
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
      toast.success('Mensaje guardado');
      setTemplates(prev => ({
        ...prev,
        [type]: { ...prev[type], [channel]: { content, customized: true } },
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando mensaje');
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
      setMpToken('');
      toast.success('Configuración de Mercado Pago guardada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando configuración');
    } finally {
      setSavingMp(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { toast.error('Escribe un nombre para la clave'); return; }
    setCreatingKey(true);
    try {
      const { data } = await api.post('/api-keys', { name: newKeyName.trim() });
      setCreatedKey(data);
      setNewKeyName('');
      setShowNewKeyForm(false);
      const { data: keys } = await api.get('/api-keys');
      setApiKeys(keys);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando clave');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!window.confirm('¿Eliminar esta clave? Dejará de funcionar de inmediato.')) return;
    try {
      await api.delete(`/api-keys/${id}`);
      setApiKeys(prev => prev.filter(k => k.id !== id));
      toast.success('Clave eliminada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error eliminando clave');
    }
  };

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';

  if (loading) return (
    <div className="max-w-2xl">
      <div className="h-8 w-40 bg-zinc-800 rounded-lg animate-pulse mb-8" />
      <div className="h-12 bg-zinc-900 rounded-xl animate-pulse mb-6" />
      <div className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-900 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  const currentPlanIdx = PLAN_ORDER.indexOf(business?.plan || 'basic');

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Administra tu cuenta y preferencias</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: MI NEGOCIO ── */}
      {activeTab === 'perfil' && (
        <div className="space-y-6">
          {/* Public booking link */}
          {bookingUrl && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="text-base font-semibold text-white mb-1">Tu página de reservas</h2>
              <p className="text-zinc-400 text-xs mb-3">
                Comparte este enlace con tus clientes para que reserven directamente.
              </p>
              <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-4 py-3">
                <span className="flex-1 text-zinc-300 text-xs font-mono truncate">{bookingUrl}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(bookingUrl);
                    toast.success('Enlace copiado');
                  }}
                  className="shrink-0 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Copiar
                </button>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-zinc-400 hover:text-white bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Ver →
                </a>
              </div>
            </div>
          )}

          {/* Profile form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-4">Datos del negocio</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Nombre del negocio *
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className={inputClass}
                  placeholder="Ej: Barbería Don José"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Teléfono de contacto
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Descripción (aparece en tu página pública)
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Escribe una breve descripción de tu negocio..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Tipo de negocio
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.values(VERTICALS).map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, vertical: v.id })); setSaved(false); }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all ${
                        form.vertical === v.id
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <span className="text-2xl">{v.icon}</span>
                      <p className={`text-xs font-semibold leading-tight ${form.vertical === v.id ? 'text-red-400' : 'text-zinc-300'}`}>
                        {v.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex items-center gap-4 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                {saved && <span className="text-emerald-400 text-sm font-medium">✓ Guardado</span>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB: PLAN ── */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-1">Tu plan actual</h2>
            <p className="text-zinc-400 text-xs mb-4">
              Actualiza tu plan para desbloquear más funciones.
            </p>
            <div className="space-y-4">
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
                        : 'border-zinc-700 bg-zinc-800/50'
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
        </div>
      )}

      {/* ── TAB: MENSAJES ── */}
      {activeTab === 'mensajes' && templates && (() => {
        const PREVIEW_VARS = {
          clientName: 'María González',
          businessName: form.name || 'Tu negocio',
          serviceName: 'Consulta General',
          date: 'lunes 15 de junio',
          time: '10:30',
          cancelLink: 'tuagenda.cl/cancel/abc123',
        };
        const CHIPS = [
          { var: 'clientName',   label: 'Nombre del cliente' },
          { var: 'businessName', label: 'Nombre del negocio' },
          { var: 'serviceName',  label: 'Servicio' },
          { var: 'date',         label: 'Fecha' },
          { var: 'time',         label: 'Hora' },
          { var: 'cancelLink',   label: 'Link cancelar' },
        ];
        const renderPreview = (text) =>
          (text || '').replace(/\{\{(\w+)\}\}/g, (_, k) =>
            `<strong class="font-semibold">${PREVIEW_VARS[k] || k}</strong>`
          );

        return (
          <div className="space-y-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
              <p className="text-zinc-400 text-sm">
                📱 Escribe aquí lo que recibirán tus clientes por WhatsApp. Si quieres agregar el nombre del cliente o la fecha automáticamente, usa las etiquetas de abajo.
              </p>
            </div>

            {[
              { key: 'booking_confirmation', icon: '✅', label: 'Cuando alguien reserva', desc: 'El cliente recibe este mensaje al confirmar su hora' },
              { key: 'reminder',             icon: '⏰', label: 'Recordatorio (24h antes)', desc: 'Se envía automáticamente el día anterior a la cita' },
              { key: 'cancellation',         icon: '❌', label: 'Cuando se cancela',         desc: 'Se envía cuando se cancela una reserva' },
            ].map(({ key, icon, label, desc }) => (
              templates[key] && (
                <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{label}</h3>
                      <p className="text-zinc-500 text-xs">{desc}</p>
                    </div>
                    {templates[key]?.whatsapp?.customized && (
                      <span className="ml-auto text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Personalizado</span>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    {/* WhatsApp editor + preview side by side */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* Editor */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 mb-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full" /> Mensaje de WhatsApp
                          {savingTemplate === `${key}:whatsapp` && <span className="text-zinc-500 ml-auto">Guardando...</span>}
                        </label>
                        <textarea
                          key={`${key}-wa`}
                          defaultValue={templates[key]?.whatsapp?.content || ''}
                          onChange={e => setTemplatePreviews(prev => ({
                            ...prev,
                            [key]: { ...(prev[key] || {}), whatsapp: e.target.value },
                          }))}
                          onBlur={e => {
                            const val = e.target.value;
                            if (val !== templates[key]?.whatsapp?.content) saveTemplate(key, 'whatsapp', val);
                          }}
                          rows={5}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                          placeholder="Escribe el mensaje aquí..."
                        />
                      </div>

                      {/* Preview */}
                      <div>
                        <label className="text-xs font-medium text-zinc-400 mb-2 block">Vista previa</label>
                        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-3 min-h-[116px]">
                          {/* Fake WhatsApp bubble */}
                          <div className="flex justify-end">
                            <div className="bg-green-800 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[90%]">
                              <p
                                className="text-white text-xs leading-relaxed whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{
                                  __html: renderPreview(
                                    templatePreviews[key]?.whatsapp !== undefined
                                      ? templatePreviews[key].whatsapp
                                      : (templates[key]?.whatsapp?.content || '')
                                  ) || '<span class="opacity-40 not-italic">Escribe un mensaje para ver la vista previa</span>',
                                }}
                              />
                              <p className="text-green-300 text-[10px] text-right mt-1 opacity-70">10:30 ✓✓</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Variable chips */}
                    <div>
                      <p className="text-xs text-zinc-500 mb-2">📎 Etiquetas automáticas — cópialas y pégalas en el mensaje:</p>
                      <div className="flex flex-wrap gap-2">
                        {CHIPS.map(c => (
                          <button
                            key={c.var}
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`{{${c.var}}}`);
                              toast.success(`"{{${c.var}}}" copiado — pégalo en el mensaje`);
                            }}
                            className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Email accordion */}
                    <div className="border-t border-zinc-800 pt-3">
                      <button
                        type="button"
                        onClick={() => setEmailExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                        className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
                      >
                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        Configurar también el correo electrónico
                        <span className="ml-1">{emailExpanded[key] ? '▲' : '▼'}</span>
                      </button>

                      {emailExpanded[key] && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="text-xs text-zinc-400 mb-1.5 block">Asunto del correo</label>
                            <input
                              key={`${key}-es`}
                              type="text"
                              defaultValue={templates[key]?.email_subject?.content || ''}
                              onBlur={e => {
                                const val = e.target.value;
                                if (val !== templates[key]?.email_subject?.content) saveTemplate(key, 'email_subject', val);
                              }}
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Ej: Tu reserva está confirmada"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-zinc-400 mb-1.5 block">Contenido del correo</label>
                            <textarea
                              key={`${key}-eb`}
                              defaultValue={templates[key]?.email_body?.content || ''}
                              onBlur={e => {
                                const val = e.target.value;
                                if (val !== templates[key]?.email_body?.content) saveTemplate(key, 'email_body', val);
                              }}
                              rows={4}
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                              placeholder="Texto del correo (puedes usar HTML básico)..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        );
      })()}

      {/* ── TAB: INTEGRACIONES ── */}
      {activeTab === 'integraciones' && (
        <div className="space-y-5">

          {/* Mercado Pago */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">💰</span>
              <div>
                <h2 className="text-base font-semibold text-white">Mercado Pago</h2>
                <p className="text-zinc-400 text-xs mt-0.5">
                  Tus clientes podrán pagar su reserva online al momento de agendar.{' '}
                  <a
                    href="https://www.mercadopago.cl/developers/es/docs/getting-started/create-account"
                    target="_blank"
                    rel="noreferrer"
                    className="text-red-400 hover:text-red-300 underline"
                  >
                    Cómo obtener tu clave
                  </a>
                </p>
              </div>
            </div>

            {mpTokenConfigured && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 mb-4">
                <span className="text-emerald-400 text-sm">✓ Cuenta de Mercado Pago conectada</span>
                <span className="text-zinc-500 text-xs ml-auto">Para cambiarla, ingresa una nueva clave</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Access Token {mpTokenConfigured ? '(dejar vacío para mantener)' : ''}
                </label>
                <input
                  type="password"
                  value={mpToken}
                  onChange={e => setMpToken(e.target.value)}
                  placeholder={mpTokenConfigured ? '••••••••••••••••' : 'TEST-... o APP_USR-...'}
                  className={inputClass}
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Usa <code className="text-zinc-400">TEST-</code> para pruebas y <code className="text-zinc-400">APP_USR-</code> para cobros reales.
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
                  Activar cobro online al reservar
                </label>
              </div>

              <button
                onClick={saveMpSettings}
                disabled={savingMp}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                {savingMp ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Google Calendar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">📅</span>
              <div>
                <h2 className="text-base font-semibold text-white">Google Calendar</h2>
                <p className="text-zinc-400 text-xs mt-0.5">
                  Cada reserva nueva aparecerá automáticamente en tu Google Calendar.
                  Al cancelar, se elimina el evento.
                </p>
              </div>
            </div>

            {!googleConnected ? (
              <button
                onClick={connectGoogleCalendar}
                disabled={googleLoading}
                className="w-full bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-900 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {googleLoading ? 'Conectando...' : 'Conectar con Google'}
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
      )}

      {/* ── TAB: AVANZADO ── */}
      {activeTab === 'avanzado' && (
        <div className="space-y-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 mb-1">
              <div>
                <h2 className="text-base font-semibold text-white">Claves de API</h2>
                <p className="text-zinc-400 text-xs mt-1 mb-4">
                  Sirven para conectar otras aplicaciones con tu agenda (por ejemplo, tu propio sistema o una planilla de Excel automática).
                  <br />
                  <span className="text-zinc-500">Si no sabes para qué sirve esto, probablemente no lo necesitas.</span>
                </p>
              </div>
              {!showNewKeyForm && (
                <button
                  onClick={() => setShowNewKeyForm(true)}
                  className="shrink-0 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Nueva clave
                </button>
              )}
            </div>

            {createdKey && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4">
                <p className="text-emerald-400 text-sm font-medium mb-2">✓ Clave creada</p>
                <p className="text-zinc-300 text-xs font-mono break-all mb-2 select-all bg-zinc-800 rounded-lg px-3 py-2">
                  {createdKey.key}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { navigator.clipboard.writeText(createdKey.key); toast.success('Clave copiada'); }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg"
                  >
                    Copiar clave
                  </button>
                  <button
                    onClick={() => setCreatedKey(null)}
                    className="text-xs text-zinc-500 hover:text-zinc-400"
                  >
                    Cerrar
                  </button>
                </div>
                <p className="text-amber-400 text-xs mt-2">
                  ⚠️ Guarda esta clave ahora — no se puede ver de nuevo después.
                </p>
              </div>
            )}

            {showNewKeyForm && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 mb-4 space-y-3">
                <label className="block text-sm font-medium text-zinc-300">
                  ¿Para qué vas a usar esta clave?
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
                  placeholder="Ej: Mi app móvil, Google Sheets, CRM"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateKey}
                    disabled={creatingKey || !newKeyName.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {creatingKey ? 'Creando...' : 'Crear clave'}
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
                <div key={k.id} className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3">
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
                    Eliminar
                  </button>
                </div>
              ))}
              {apiKeys.length === 0 && !showNewKeyForm && (
                <p className="text-zinc-500 text-sm text-center py-6">No tienes claves de API creadas</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
