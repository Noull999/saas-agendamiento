import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PLAN_ORDER = ['basic', 'pro', 'business'];
const PLAN_LABELS = { basic: 'Basic', pro: 'Pro', business: 'Business' };

// Tailwind no genera clases dinámicas (bg-${color}-100), así que usamos mapas completos.
const ICON_BG = {
  basic:    'bg-zinc-700',
  pro:      'bg-red-500/10',
  business: 'bg-violet-500/10',
};
const BTN_CLASS = {
  basic:    'bg-zinc-700 hover:bg-zinc-600',
  pro:      'bg-red-600 hover:bg-red-700',
  business: 'bg-violet-600 hover:bg-violet-700',
};

export default function PlanGate({ minPlan, children, feature = 'esta función' }) {
  const { business } = useAuth();
  const currentIdx = PLAN_ORDER.indexOf(business?.plan || 'basic');
  const requiredIdx = PLAN_ORDER.indexOf(minPlan);

  if (currentIdx >= requiredIdx) return children;

  const iconBg  = ICON_BG[minPlan]  ?? ICON_BG.pro;
  const btnCls  = BTN_CLASS[minPlan] ?? BTN_CLASS.pro;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-30 blur-sm">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 p-8 text-center max-w-sm mx-4">
          <div className={`w-14 h-14 ${iconBg} rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4`}>
            🔒
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            Requiere plan {PLAN_LABELS[minPlan]}
          </h3>
          <p className="text-zinc-400 text-sm mb-5">
            Actualiza tu plan para acceder a {feature}.
          </p>
          <Link
            to="/dashboard/configuracion"
            className={`inline-block ${btnCls} text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors`}
          >
            Ver planes →
          </Link>
        </div>
      </div>
    </div>
  );
}
