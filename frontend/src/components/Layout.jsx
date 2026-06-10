import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVertical, meetsMinPlan } from '../config/verticals.config';
import GlobalSearch from './GlobalSearch';

export default function Layout({ children }) {
  const { business, logout } = useAuth();
  const navigate = useNavigate();

  const vertical = getVertical(business?.vertical);
  const handleLogout = () => { logout(); navigate('/'); };

  const [now] = useState(() => Date.now());
  const isTrial = business?.subscription_status === 'trial';
  const trialDaysLeft = isTrial && business?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(business.trial_ends_at) - now) / 86400000))
    : null;

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <aside className="w-60 bg-zinc-950 flex flex-col shrink-0 border-r border-zinc-800">
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {business?.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="min-w-0">
              <span className="text-white font-semibold text-sm truncate block">{business?.name || 'Dashboard'}</span>
              <span className="text-zinc-500 text-xs capitalize">
                {isTrial ? 'Prueba gratis' : (business?.plan || 'basic')}
              </span>
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
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400 transition-colors"
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
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`
                }
              >
                <span>{icon}</span>
                {label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-1">
          {business?.plan === 'basic' && (
            <Link
              to="/dashboard/configuracion"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
            >
              ⚡ Subir a Pro
            </Link>
          )}
          {business?.slug && (
            <a
              href={`/book/${business.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <span>🔗</span>
              Página pública
            </a>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <span>🚪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-zinc-950 flex flex-col">
        {isTrial && trialDaysLeft != null && (
          <div className={`px-8 py-2.5 text-sm flex items-center justify-between gap-3 border-b ${
            trialDaysLeft <= 3
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            <span>
              🎁 Prueba gratis: {trialDaysLeft === 0
                ? 'termina hoy'
                : trialDaysLeft === 1 ? 'queda 1 día' : `quedan ${trialDaysLeft} días`}
              {' '}— todas las funciones desbloqueadas
            </span>
            <Link
              to="/dashboard/configuracion"
              className="shrink-0 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Elegir plan
            </Link>
          </div>
        )}
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>

      <GlobalSearch />
    </div>
  );
}
