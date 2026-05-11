export default function LuxuryPremiumTemplate({ business, branding, sections, sectionOrder, children }) {
  const getFontFamily = (fontId) => {
    const fonts = {
      inter: "'Inter', sans-serif",
      poppins: "'Poppins', sans-serif",
      roboto: "'Roboto', sans-serif",
      playfair: "'Playfair Display', serif"
    };
    return fonts[fontId] || fonts.inter;
  };

  const visibleSections = (sectionOrder || []).filter(id => sections[id]?.enabled);

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: getFontFamily(branding?.font_family) }}
    >
      {/* Decorative Top Line */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: branding?.primary_color || '#d4af37' }}
      ></div>

      {/* Header - Premium */}
      <header className="px-8 py-16 md:py-24 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5"
          style={{ backgroundColor: branding?.primary_color }}
        ></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt="Logo" className="h-20 object-contain mx-auto mb-8 filter brightness-200" />
          )}

          <h1
            className="text-5xl md:text-6xl font-light mb-6 tracking-wide"
            style={{ color: branding?.primary_color || '#d4af37', fontFamily: "'Playfair Display', serif" }}
          >
            {business?.name}
          </h1>

          {business?.specialty && (
            <p className="text-lg tracking-widest text-gray-400 mb-8">
              {business.specialty.toUpperCase()}
            </p>
          )}

          <div
            className="w-24 h-1 mx-auto mb-8"
            style={{ backgroundColor: branding?.primary_color || '#d4af37' }}
          ></div>

          {sections.hero?.text && (
            <p className="text-gray-300 text-lg leading-relaxed max-w-2xl mx-auto">
              {sections.hero.text}
            </p>
          )}
        </div>
      </header>

      {/* Navigation - Minimal */}
      <nav className="sticky top-0 z-40 px-8 py-4 border-b border-gray-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span
            className="text-sm tracking-wider font-light"
            style={{ color: branding?.primary_color || '#d4af37' }}
          >
            {business?.name?.toUpperCase()}
          </span>

          <div className="flex gap-8">
            {visibleSections.slice(0, 3).map((sectionId) => (
              <a
                key={sectionId}
                href={`#${sectionId}`}
                className="text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-wider"
              >
                {sections[sectionId]?.title || sectionId}
              </a>
            ))}

            {business?.phone && (
              <a
                href={`tel:${business.phone}`}
                className="text-xs uppercase tracking-wider"
                style={{ color: branding?.primary_color }}
              >
                Contactar
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="max-w-5xl mx-auto px-8 py-20">
        <div className="space-y-32">
          {visibleSections.map((sectionId, idx) => {
            const section = sections[sectionId];

            return (
              <section key={sectionId} id={sectionId} className="scroll-mt-20">
                {/* Sección con imagen de fondo */}
                {section.bg_image_url && (
                  <div className="mb-12 relative h-96 overflow-hidden rounded-sm">
                    <img
                      src={section.bg_image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                  </div>
                )}

                {/* Título */}
                {section.title && (
                  <div className="mb-8">
                    <div
                      className="w-12 h-1 mb-6"
                      style={{ backgroundColor: branding?.primary_color }}
                    ></div>
                    <h2
                      className="text-4xl font-light tracking-wide mb-4"
                      style={{ color: branding?.primary_color, fontFamily: "'Playfair Display', serif" }}
                    >
                      {section.title}
                    </h2>
                  </div>
                )}

                {/* Texto descriptivo */}
                {section.text && (
                  <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-2xl">
                    {section.text}
                  </p>
                )}

                {/* Imagen destacada */}
                {section.image_url && (
                  <img
                    src={section.image_url}
                    alt={section.title}
                    className="w-full h-96 object-cover rounded-sm mb-8"
                  />
                )}

                {/* Servicios */}
                {sectionId === 'services' && (
                  <div className="mt-12">
                    {children}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>

      {/* Footer - Premium */}
      <footer className="border-t border-gray-800 mt-32 px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <div
                className="w-8 h-1 mb-4"
                style={{ backgroundColor: branding?.primary_color }}
              ></div>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Información</p>
              {business?.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="block text-gray-300 mt-4 hover:text-white transition-colors"
                >
                  {business.phone}
                </a>
              )}
            </div>

            <div>
              <div
                className="w-8 h-1 mb-4"
                style={{ backgroundColor: branding?.primary_color }}
              ></div>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Empresa</p>
              <p className="text-gray-300 mt-4">{business?.name}</p>
            </div>

            <div>
              <div
                className="w-8 h-1 mb-4"
                style={{ backgroundColor: branding?.primary_color }}
              ></div>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Especialidad</p>
              {business?.specialty && (
                <p className="text-gray-300 mt-4">{business.specialty}</p>
              )}
            </div>
          </div>

          <div
            className="border-t border-gray-800 pt-8 text-center text-xs text-gray-600 uppercase tracking-wider"
          >
            <p>© 2024 {business?.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Decorative Bottom Line */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: branding?.primary_color || '#d4af37' }}
      ></div>
    </div>
  );
}
