import { useState } from 'react';
import { Link } from 'react-router-dom';

/* ─── Contenido por vertical ──────────────────────────────────────────────── */
const CONTENT = {
  salud: {
    icon: '🏥',
    label: 'Clínicas & Salud',
    headline: 'Deja de agendar citas por WhatsApp.',
    subline: 'Gestiona pacientes, reservas e historial clínico desde un solo lugar. Seguro, simple y sin papeles.',
    pains: [
      { icon: '📱', title: 'Citas por WhatsApp', desc: 'Mensajes perdidos, confirmaciones manuales y caos puro.' },
      { icon: '📋', title: 'Fichas en papel', desc: 'Información dispersa que nadie encuentra cuando se necesita.' },
      { icon: '📞', title: 'Llamadas para confirmar', desc: 'Horas al teléfono que podrías usar atendiendo pacientes.' },
      { icon: '🚶', title: 'No-shows sin aviso', desc: 'Pacientes que no llegan y horas que se pierden para siempre.' },
    ],
    features: [
      { icon: '📅', title: 'Reservas online 24/7', desc: 'Tus pacientes agendan solos. Tú solo confirmas.' },
      { icon: '🔒', title: 'Historial clínico cifrado', desc: 'Notas, recetas y diagnósticos con cifrado AES-256.' },
      { icon: '💬', title: 'Recordatorios por WhatsApp', desc: 'Reduce no-shows hasta un 40% automáticamente.' },
      { icon: '👥', title: 'Multi-profesional', desc: 'Médicos, kinesiólogos y más desde un solo panel.' },
      { icon: '📊', title: 'Analytics de ingresos', desc: 'Visualiza tendencias, servicios más rentables y ocupación.' },
      { icon: '🔗', title: 'Página de reservas pública', desc: 'Link único para compartir en redes o tarjeta de visita.' },
    ],
    accent: 'text-red-400',
    border: 'border-red-500',
    activeBg: 'bg-red-500/10',
    gradient: 'from-red-900 to-zinc-900',
    ctaBtnClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  belleza: {
    icon: '💇',
    label: 'Belleza & Estética',
    headline: 'Tu agenda llena, sin el caos.',
    subline: 'Automatiza reservas, elimina no-shows y gestiona tu salón como un pro. Todo desde tu celular.',
    pains: [
      { icon: '📸', title: 'Reservas por Instagram', desc: 'DMs mezclados, sin confirmación y clientes confundidos.' },
      { icon: '🤷', title: 'Clientes que no llegan', desc: 'Sin recordatorios automáticos, los no-shows son la norma.' },
      { icon: '📓', title: 'Agenda en cuaderno', desc: 'Borrones, turnos dobles y caos cuando llega el rush.' },
      { icon: '🔁', title: 'Sin historial de servicios', desc: 'No recuerdas qué le hiciste al cliente la última vez.' },
    ],
    features: [
      { icon: '📅', title: 'Reservas online 24/7', desc: 'Tus clientes agendan solos, en cualquier momento.' },
      { icon: '✂️', title: 'Catálogo de servicios', desc: 'Cortes, coloración y tratamientos con duración y precio.' },
      { icon: '💬', title: 'Recordatorios por WhatsApp', desc: 'Tus clientes reciben aviso automático antes de su cita.' },
      { icon: '👥', title: 'Gestión de estilistas', desc: 'Turnos por profesional y control completo del equipo.' },
      { icon: '📊', title: 'Analytics del salón', desc: 'Servicios más pedidos, ingresos por estilista y más.' },
      { icon: '🔗', title: 'Link de reservas para tu bio', desc: 'Link único para Instagram, WhatsApp o tu tarjeta.' },
    ],
    accent: 'text-pink-400',
    border: 'border-pink-500',
    activeBg: 'bg-pink-500/10',
    gradient: 'from-pink-900 to-zinc-900',
    ctaBtnClass: 'bg-pink-600 hover:bg-pink-700 text-white',
  },
  general: {
    icon: '🏢',
    label: 'Otro negocio',
    headline: 'Profesionaliza tu agenda hoy.',
    subline: 'Consultorías, talleres, clases y arriendo de espacios. Gestiona reservas y clientes sin Excel ni WhatsApp.',
    pains: [
      { icon: '📲', title: 'Reservas por WhatsApp', desc: 'Mensajes perdidos y confirmaciones que se olvidan.' },
      { icon: '📓', title: 'Agenda en papel o Excel', desc: 'Turnos dobles, errores y pérdida de tiempo.' },
      { icon: '🔁', title: 'Sin historial de clientes', desc: 'No sabes quién vuelve, quién cancela ni cuánto genera.' },
      { icon: '🚶', title: 'No-shows sin aviso', desc: 'Bloques vacíos que no se pueden recuperar.' },
    ],
    features: [
      { icon: '📅', title: 'Reservas online 24/7', desc: 'Tus clientes agendan solos, en cualquier momento.' },
      { icon: '🛠', title: 'Catálogo de servicios', desc: 'Define lo que ofreces, duración y precio en minutos.' },
      { icon: '💬', title: 'Recordatorios por WhatsApp', desc: 'Reduce no-shows hasta un 40% con avisos automáticos.' },
      { icon: '👥', title: 'Gestión de equipo', desc: 'Asigna personas a cada reserva y controla disponibilidad.' },
      { icon: '📊', title: 'Analytics de ingresos', desc: 'Visualiza qué servicios generan más y cuándo estás más ocupado.' },
      { icon: '🔗', title: 'Link de reservas público', desc: 'Compártelo en Instagram, WhatsApp o tu sitio web.' },
    ],
    accent: 'text-violet-400',
    border: 'border-violet-500',
    activeBg: 'bg-violet-500/10',
    gradient: 'from-violet-900 to-zinc-900',
    ctaBtnClass: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
};

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '$9.990',
    period: '/mes',
    desc: 'Para empezar sin complicaciones',
    features: [
      '1 profesional',
      'Hasta 100 reservas/mes',
      'Página de reservas pública',
      'Recordatorios automáticos',
      'Soporte por email',
    ],
    cta: 'Empezar gratis',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19.990',
    period: '/mes',
    desc: 'Para negocios que quieren crecer',
    features: [
      'Hasta 5 profesionales',
      'Reservas ilimitadas',
      'Recordatorios WhatsApp automáticos',
      'Historial de clientes y pacientes',
      'Consultas y fichas clínicas',
      'Analytics de ingresos',
      'Soporte prioritario',
    ],
    cta: 'Empezar gratis',
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$34.990',
    period: '/mes',
    desc: 'Para centros con alto volumen',
    features: [
      'Profesionales ilimitados',
      'Reservas ilimitadas',
      'Todo lo del plan Pro',
      'Integración con bot WhatsApp (add-on)',
      'Múltiples sedes',
      'Onboarding personalizado',
    ],
    cta: 'Contactar ventas',
    highlight: false,
  },
];

const GENERIC_FEATURES = [
  { icon: '📅', title: 'Reservas online 24/7', desc: 'Tus clientes agendan solos, en cualquier momento del día.' },
  { icon: '💬', title: 'Recordatorios por WhatsApp', desc: 'Reduce no-shows hasta un 40% con avisos automáticos.' },
  { icon: '👥', title: 'Gestión de equipo', desc: 'Administra múltiples profesionales desde un solo panel.' },
  { icon: '📊', title: 'Analytics de ingresos', desc: 'Visualiza tendencias, servicios más rentables y ocupación.' },
  { icon: '🔒', title: 'Historial seguro', desc: 'Datos cifrados con estándar bancario AES-256.' },
  { icon: '🔗', title: 'Página de reservas pública', desc: 'Link único listo para compartir en redes o WhatsApp.' },
];

const FAQS = [
  { q: '¿Mis datos están seguros?', a: 'Sí. Todos los datos sensibles se cifran con AES-256, el mismo estándar que usan los bancos. Nunca compartimos tu información con terceros.' },
  { q: '¿Funciona para mi especialidad?', a: 'Sí. Tenemos configuraciones para medicina, kinesiología, psicología, nutrición, odontología, peluquerías, barberías, spas, consultoría, talleres y más.' },
  { q: '¿Puedo cancelar cuando quiera?', a: 'Absolutamente. Sin contratos de permanencia. Cancelas en un clic desde tu configuración y no te cobramos nada más.' },
  { q: '¿Necesito saber de tecnología?', a: 'No. La configuración toma menos de 30 minutos y tenemos guías paso a paso. Soporte en español incluido.' },
  { q: '¿Cómo agendan mis clientes?', a: 'Obtienes un link único que compartes donde quieras. Tus clientes agendan sin crear cuenta — solo eligen día, hora y listo.' },
  { q: '¿Qué pasa si supero el límite del plan Basic?', a: 'Te avisamos antes de llegar al límite. Puedes subir a Pro en un clic desde tu configuración — sin perder ningún dato.' },
];

/* ─── Mockup del dashboard (dark theme real) ─────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Browser bar */}
        <div className="bg-zinc-800 px-4 py-3 flex items-center gap-2 border-b border-zinc-700">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
          <div className="flex-1 mx-4 bg-zinc-900 rounded-md px-3 py-1 text-xs text-zinc-500 text-center">
            app.agendasaas.com/dashboard
          </div>
        </div>

        {/* App shell */}
        <div className="flex" style={{ height: '340px' }}>
          {/* Sidebar */}
          <div className="bg-zinc-950 w-44 shrink-0 flex flex-col py-4 border-r border-zinc-800">
            <div className="px-4 mb-5">
              <div className="text-white text-xs font-bold truncate">Mi Clínica</div>
              <div className="text-zinc-500 text-xs">Plan Pro</div>
            </div>
            {[
              ['📅', 'Reservas', true],
              ['🛠', 'Servicios', false],
              ['🕐', 'Horarios', false],
              ['👤', 'Pacientes', false],
              ['🩺', 'Consultas', false],
              ['👥', 'Profesionales', false],
              ['📊', 'Analytics', false],
              ['⚙️', 'Configuración', false],
            ].map(([icon, label, active]) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-xs mb-0.5 ${
                  active ? 'bg-red-600 text-white' : 'text-zinc-400'
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-hidden bg-zinc-950 p-5">
            <div className="mb-4">
              <div className="text-white font-bold text-base">Reservas</div>
              <div className="text-zinc-500 text-xs">Próximas citas de tu negocio</div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ['Total próximas', '6', 'text-white'],
                ['Confirmadas', '5', 'text-emerald-400'],
                ['Con ficha', '3', 'text-red-400'],
              ].map(([label, val, color]) => (
                <div key={label} className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
                  <div className="text-xs text-zinc-500 mb-1">{label}</div>
                  <div className={`text-xl font-bold ${color}`}>{val}</div>
                </div>
              ))}
            </div>

            {/* Reservation list */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="text-xs text-zinc-500 px-4 py-2 border-b border-zinc-800 font-medium">
                Hoy
              </div>
              {[
                ['JP', 'Juan Pérez',      'Limpieza Dental · 45 min', '09:00', 'Confirmada'],
                ['MG', 'María González',  'Obturación · 60 min',      '10:30', 'Confirmada'],
                ['SV', 'Sofía Vargas',    'Limpieza Dental · 45 min', '14:00', 'Pendiente'],
              ].map(([initials, name, svc, time, status]) => (
                <div key={name} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-red-500/10 text-red-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{name}</div>
                    <div className="text-xs text-zinc-500 truncate">{svc}</div>
                  </div>
                  <div className="text-xs text-red-400 font-medium shrink-0">{time}</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full shrink-0 border ${
                    status === 'Confirmada'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}>
                    {status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Componente principal ────────────────────────────────────────────────── */
export default function LandingPage() {
  const [vertical, setVertical] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);
  const v = vertical ? CONTENT[vertical] : null;

  const handleVerticalSelect = (id) => {
    setVertical(id);
    setTimeout(() => {
      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-zinc-950" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-sm">📅</div>
            <span className="font-bold text-white text-lg tracking-tight">AgendaSaaS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Funciones</a>
            <a href="#pricing"  className="hover:text-white transition-colors">Precios</a>
            <a href="#faq"      className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">
              Iniciar sesión
            </Link>
            <Link to="/register" className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium">
              Empezar gratis →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="bg-zinc-950 relative overflow-hidden">
        {/* Glow sutil detrás del hero */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 relative">
          {v ? (
            <div className="text-center mb-14">
              <button
                onClick={() => setVertical(null)}
                className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-1.5 text-sm text-zinc-400 mb-6 hover:border-zinc-500 transition-colors"
              >
                <span>{v.icon}</span>
                <span>{v.label}</span>
                <span className="text-zinc-600 ml-1">✕ cambiar</span>
              </button>
              <h1
                style={{ fontFamily: "'DM Serif Display', serif" }}
                className="text-5xl md:text-6xl font-normal text-white mb-5 leading-tight"
              >
                {v.headline}
              </h1>
              <p className="text-xl text-zinc-400 max-w-xl mx-auto mb-8 leading-relaxed">{v.subline}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/register" className={`${v.ctaBtnClass} px-8 py-3.5 rounded-xl text-sm font-semibold transition-colors shadow-lg`}>
                  Prueba gratis 14 días →
                </Link>
                <a href="#features" className="text-sm text-zinc-500 hover:text-white transition-colors">
                  Ver todas las funciones ↓
                </a>
              </div>
              <p className="text-xs text-zinc-600 mt-3">Sin tarjeta de crédito · Configuración en 30 minutos</p>
            </div>
          ) : (
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 rounded-full px-4 py-1.5 text-xs text-red-400 font-medium mb-6">
                🚀 Nuevo · Analytics mejorado con comparación de períodos
              </div>
              <h1
                style={{ fontFamily: "'DM Serif Display', serif" }}
                className="text-5xl md:text-6xl font-normal text-white mb-5 leading-tight"
              >
                Deja de agendar<br />por WhatsApp.
              </h1>
              <p className="text-xl text-zinc-400 max-w-xl mx-auto mb-8 leading-relaxed">
                Reservas online, recordatorios automáticos e historial de clientes — todo en un solo lugar.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/register"
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-red-900/30"
                >
                  Empezar gratis →
                </Link>
                <span className="text-sm text-zinc-500">o selecciona tu área abajo</span>
              </div>
              <p className="text-xs text-zinc-600 mt-3">Sin tarjeta de crédito · Configuración en 30 minutos</p>
            </div>
          )}

          {/* Vertical cards */}
          <div className="max-w-3xl mx-auto mb-16">
            {!v && (
              <p className="text-center text-xs font-semibold text-zinc-600 mb-4 uppercase tracking-wider">
                ¿Para qué tipo de negocio?
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(CONTENT).map(([id, c]) => {
                const isActive = vertical === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleVerticalSelect(id)}
                    className={`group p-5 rounded-2xl border-2 text-left transition-all ${
                      isActive
                        ? `${c.border} ${c.activeBg}`
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="text-3xl mb-3">{c.icon}</div>
                    <p className="font-semibold text-white text-sm mb-1">{c.label}</p>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      {id === 'salud'   ? 'Médicos, psicólogos, kinesiólogos, nutricionistas...' :
                       id === 'belleza' ? 'Peluquerías, barberías, spa, nail art, salones...' :
                                         'Consultorías, talleres, clases, arriendos...'}
                    </p>
                    {isActive && (
                      <p className={`mt-3 text-xs font-semibold ${c.accent}`}>Seleccionado ✓</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dashboard mockup */}
          <DashboardMockup />
        </div>
      </section>

      {/* ── SOCIAL PROOF BAND ───────────────────────────────────────────────── */}
      <section className="py-10 bg-zinc-900 border-y border-zinc-800">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { n: '500+',   label: 'negocios activos'    },
              { n: '40%',    label: 'menos no-shows'      },
              { n: '30 min', label: 'de setup promedio'   },
              { n: '4.9 ★',  label: 'satisfacción'        },
            ].map(({ n, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{n}</p>
                <p className="text-zinc-500 text-sm mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN POINTS (solo con vertical seleccionado) ────────────────────── */}
      {v && (
        <section className="py-20 bg-zinc-950">
          <div className="max-w-6xl mx-auto px-6">
            <h2
              style={{ fontFamily: "'DM Serif Display', serif" }}
              className="text-4xl font-normal text-white text-center mb-3"
            >
              ¿Te suena familiar?
            </h2>
            <p className="text-zinc-500 text-center mb-12">Lo que suele pasar sin un sistema como este.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {v.pains.map((p) => (
                <div key={p.title} className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                  <div className="text-3xl mb-4">{p.icon}</div>
                  <h3 className="font-semibold text-white mb-2 text-sm">{p.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-6">
          <h2
            style={{ fontFamily: "'DM Serif Display', serif" }}
            className="text-4xl font-normal text-white text-center mb-3"
          >
            Todo lo que necesitas para operar como pro
          </h2>
          <p className="text-zinc-500 text-center mb-10">
            {v
              ? `Funciones específicas para ${v.label.toLowerCase()}.`
              : 'Funciona para clínicas, salones de belleza y cualquier negocio de servicios.'}
          </p>

          {/* Tab switcher */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            <button
              onClick={() => setVertical(null)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                !vertical
                  ? 'border-red-500 bg-red-500/10 text-red-400'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
              }`}
            >
              🌐 Todas las áreas
            </button>
            {Object.entries(CONTENT).map(([id, c]) => (
              <button
                key={id}
                onClick={() => setVertical(id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  vertical === id
                    ? `${c.border} ${c.activeBg} ${c.accent}`
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                }`}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(v ? v.features : GENERIC_FEATURES).map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800 transition-all group"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-white mb-2 text-sm">{f.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6">
          <h2
            style={{ fontFamily: "'DM Serif Display', serif" }}
            className="text-4xl font-normal text-white text-center mb-3"
          >
            Empieza en 3 pasos
          </h2>
          <p className="text-zinc-500 text-center mb-16">
            Menos de una hora desde el registro a tu primera reserva.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { n: '01', title: 'Crea tu cuenta gratis', desc: 'Regístrate en 2 minutos. Sin tarjeta de crédito ni compromisos.' },
              { n: '02', title: 'Configura tu negocio', desc: 'Agrega tus servicios, horarios y profesionales en 30 minutos.' },
              { n: '03', title: 'Comparte tu link', desc: 'Tus clientes empiezan a agendar solos desde el mismo día.' },
            ].map((step, i) => (
              <div key={step.n} className="text-center relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] right-0 h-px border-t border-dashed border-zinc-700" />
                )}
                <div className="w-16 h-16 bg-zinc-900 border-2 border-red-600/40 rounded-2xl flex items-center justify-center text-2xl font-bold text-red-500 mx-auto mb-6">
                  {step.n}
                </div>
                <h3 className="text-white font-semibold text-base mb-2">{step.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-6">
          <h2
            style={{ fontFamily: "'DM Serif Display', serif" }}
            className="text-4xl font-normal text-white text-center mb-3"
          >
            Planes para cada etapa
          </h2>
          <p className="text-zinc-500 text-center mb-12">Sin contratos. Cancela cuando quieras.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl p-8 border-2 relative flex flex-col transition-all ${
                  plan.highlight
                    ? 'border-red-500 bg-red-500/5 shadow-xl shadow-red-900/20'
                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    MÁS POPULAR
                  </div>
                )}
                <div className={`text-xs font-semibold mb-1 uppercase tracking-wider ${plan.highlight ? 'text-red-400' : 'text-zinc-500'}`}>
                  {plan.name}
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm mb-1.5 text-zinc-500">{plan.period}</span>
                </div>
                <p className="text-sm text-zinc-500 mb-6">{plan.desc}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className={plan.highlight ? 'text-red-400' : 'text-emerald-500'}>✓</span>
                      <span className="text-zinc-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/30'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-zinc-600 mt-8">
            Precios en CLP. Todos los planes incluyen 14 días de prueba gratuita.
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6">
          <h2
            style={{ fontFamily: "'DM Serif Display', serif" }}
            className="text-4xl font-normal text-white text-center mb-12"
          >
            Preguntas frecuentes
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between font-medium text-white hover:bg-zinc-800 transition-colors text-sm"
                >
                  <span>{faq.q}</span>
                  <span className="text-zinc-500 ml-4 shrink-0 text-lg leading-none">
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-zinc-400 text-sm leading-relaxed border-t border-zinc-800 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────────────────── */}
      <section className={`py-24 bg-gradient-to-br ${v ? v.gradient : 'from-red-950 to-zinc-950'}`}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2
            style={{ fontFamily: "'DM Serif Display', serif" }}
            className="text-4xl md:text-5xl font-normal text-white mb-4 leading-tight"
          >
            Empieza hoy. Tu primera reserva<br />en menos de una hora.
          </h2>
          <p className="text-white/50 mb-8">14 días gratis, sin tarjeta de crédito. Cancela cuando quieras.</p>
          <Link
            to="/register"
            className="inline-block bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-xl text-sm font-bold transition-colors shadow-xl shadow-red-900/40"
          >
            Crear cuenta gratis →
          </Link>
          <div className="flex items-center justify-center gap-6 mt-6 text-white/40 text-xs">
            <span>✓ 14 días gratis</span>
            <span>✓ Sin tarjeta</span>
            <span>✓ Soporte en español</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-zinc-950 border-t border-zinc-800 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-sm">📅</div>
            <span className="font-semibold text-white">AgendaSaaS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link to="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
            <Link to="/terminos"   className="hover:text-white transition-colors">Términos</Link>
            <a href="#"            className="hover:text-white transition-colors">Contacto</a>
          </div>
          <p className="text-zinc-700 text-xs">© 2026 AgendaSaaS. Todos los derechos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
