import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { business, logout } = useAuth();
  const navigate = useNavigate();

  const isPro = business?.plan === 'pro' || business?.plan === 'clinic';

  const handleLogout = () => { logout(); navigate('/login'); };

  const links = [
    { to: '/dashboard', label: 'Reservas', icon: '📅' },
    { to: '/dashboard/servicios', label: 'Servicios', icon: '🛠' },
    { to: '/dashboard/horarios', label: 'Horarios', icon: '🕐' },
    { to: '/dashboard/pacientes', label: 'Pacientes', icon: '👤' },
    ...(isPro ? [{ to: '/dashboard/profesionales', label: 'Profesionales', icon: '👥' }] : []),
    { to: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
    { to: '/dashboard/diseño', label: 'Diseño Página', icon: '🎨' },
    { to: '/dashboard/configuracion', label: 'Configuración', icon: '⚙️' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 bg-slate-900 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {business?.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <span className="text-white font-semibold text-sm truncate">{business?.name || 'Dashboard'}</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {links.map(({ to, label, icon }) => (
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
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1">
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
