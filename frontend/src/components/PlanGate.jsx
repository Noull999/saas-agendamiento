import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PLAN_ORDER = ['basic', 'pro', 'business'];
const PLAN_LABELS = { basic: 'Basic', pro: 'Pro', business: 'Business' };
const PLAN_COLORS = { basic: 'slate', pro: 'indigo', business: 'violet' };

export default function PlanGate({ minPlan, children, feature = 'esta función' }) {
  const { business } = useAuth();
  const currentIdx = PLAN_ORDER.indexOf(business?.plan || 'basic');
  const requiredIdx = PLAN_ORDER.indexOf(minPlan);

  if (currentIdx >= requiredIdx) return children;

  const color = PLAN_COLORS[minPlan] || 'indigo';

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-30 blur-sm">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center max-w-sm mx-4">
          <div className={`w-14 h-14 bg-${color}-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4`}>
            🔒
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Requiere plan {PLAN_LABELS[minPlan]}
          </h3>
          <p className="text-slate-500 text-sm mb-5">
            Actualiza tu plan para acceder a {feature}.
          </p>
          <Link
            to="/dashboard/configuracion"
            className={`inline-block bg-${color}-600 hover:bg-${color}-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors`}
          >
            Ver planes →
          </Link>
        </div>
      </div>
    </div>
  );
}
