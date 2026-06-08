import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVertical, meetsMinPlan } from '../config/verticals.config';

export default function Layout({ children }) {
  const { business, logout } = useAuth();
  const navigate = useNavigate();

  const vertical = getVertical(business?.vertical);
  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 bg-slate-900 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {business?.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="min-w-0">
              <span className="text-white font-semibold text-sm truncate block">{business?.name || 'Dashboard'}</span>
              <span className="text-slate-500 text-xs capitalize">{business?.plan || 'basic'}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {vertical.modules.map(({ to, label, icon, minPlan }) => {
            const locked = minPlan && !meetsMinPlan(business?.plan, minPlan);
            if (locked) {
              return (
                <Link
                  key={to}
                  to="/dashboard/configuracion"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-800 hover:text-slate-300 transition-colors"
                  title={`Requiere plan ${minPlan}`}
                >
                  <span className="opacity-50">{icon}</span>
                  <span className="opacity-50 flex-1">{label}</span>
                  <span className="text-xs">🔒</span>
                </Link>
              );
            }
            return (
              <NavLink
                key={to} to={to} end={to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`
                }
              >
                <span>{icon}</span>
                {label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1">
          {business?.plan === 'basic' && (
            <Link
              to="/dashboard/configuracion"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-colors"
            >
              ⚡ Subir a Pro
            </Link>
          )}
          {business?.slug && (
            <a
              href={`/book/${business.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span>🔗</span>
              Página pública
            </a>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span>🚪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
