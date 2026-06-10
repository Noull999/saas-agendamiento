import { Link } from 'react-router-dom';

/**
 * Marco visual compartido para las páginas legales (Términos y Privacidad).
 * Mantiene una columna de lectura cómoda + cabecera/footer con vuelta al inicio.
 */
export default function LegalLayout({ title, updatedAt, children }) {
  return (
    <div className="min-h-screen bg-black">
      {/* Cabecera */}
      <header className="bg-zinc-950 border-b border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-sm text-white">📅</div>
            <span className="font-semibold text-white">AgendaSaaS</span>
          </Link>
          <Link to="/" className="text-sm text-zinc-500 hover:text-white transition-colors">← Volver al inicio</Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-1">{title}</h1>
        {updatedAt && (
          <p className="text-zinc-500 text-sm mb-8">Última actualización: {updatedAt}</p>
        )}
        <div className="legal-prose space-y-6 text-zinc-400 text-[15px] leading-relaxed">
          {children}
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/terminos" className="text-red-400 hover:text-red-300 hover:underline">Términos de servicio</Link>
          <Link to="/privacidad" className="text-red-400 hover:text-red-300 hover:underline">Política de privacidad</Link>
          <Link to="/" className="text-zinc-500 hover:text-white">Inicio</Link>
        </div>
      </main>
    </div>
  );
}

/** Encabezado de sección reutilizable dentro de un documento legal. */
export function LegalSection({ n, title, children }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-2">{n}. {title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
