import { Link } from 'react-router-dom';

/**
 * Marco visual compartido para las páginas legales (Términos y Privacidad).
 * Mantiene una columna de lectura cómoda + cabecera/footer con vuelta al inicio.
 */
export default function LegalLayout({ title, updatedAt, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Cabecera */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center text-sm text-white">📅</div>
            <span className="font-semibold text-slate-900">AgendaSaaS</span>
          </Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">← Volver al inicio</Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">{title}</h1>
        {updatedAt && (
          <p className="text-slate-400 text-sm mb-8">Última actualización: {updatedAt}</p>
        )}
        <div className="legal-prose space-y-6 text-slate-600 text-[15px] leading-relaxed">
          {children}
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/terminos" className="text-indigo-600 hover:underline">Términos de servicio</Link>
          <Link to="/privacidad" className="text-indigo-600 hover:underline">Política de privacidad</Link>
          <Link to="/" className="text-slate-500 hover:text-slate-900">Inicio</Link>
        </div>
      </main>
    </div>
  );
}

/** Encabezado de sección reutilizable dentro de un documento legal. */
export function LegalSection({ n, title, children }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900 mb-2">{n}. {title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
