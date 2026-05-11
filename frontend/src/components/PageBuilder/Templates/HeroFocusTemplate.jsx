export default function HeroFocusTemplate({ business, branding, sections, sectionOrder, children }) {
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
  const heroSection = sections.hero;

  return (
    <div
      className={branding?.dark_mode ? 'bg-gray-900' : 'bg-white'}
      style={{ fontFamily: getFontFamily(branding?.font_family) }}
    >
      {/* Hero Section - Main Focus */}
      <header
        className="relative w-full min-h-[600px] md:min-h-[700px] flex items-center justify-center overflow-hidden"
      >
        {/* Background */}
        {heroSection?.bg_image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroSection.bg_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black opacity-40"></div>
          </div>
        )}

        {/* Gradient background if no image */}
        {!heroSection?.bg_image_url && (
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: `linear-gradient(135deg, ${branding?.primary_color || '#ec4899'}, ${branding?.secondary_color || '#db2777'})`
            }}
          ></div>
        )}

        {/* Content */}
        <div className="relative z-10 text-center max-w-3xl px-6">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt="Logo" className="h-20 object-contain mx-auto mb-8" />
          )}

          <h1
            className="text-5xl md:text-6xl font-bold mb-4 text-white"
            style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}
          >
            {business?.name}
          </h1>

          {business?.specialty && (
            <p
              className="text-xl md:text-2xl text-white mb-8"
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
            >
              {business.specialty}
            </p>
          )}

          {heroSection?.text && (
            <p
              className="text-lg text-gray-100 max-w-xl mx-auto mb-12"
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
            >
              {heroSection.text}
            </p>
          )}

          {/* CTA Button */}
          <button
            style={{ backgroundColor: branding?.primary_color || '#ec4899' }}
            className="px-8 py-3 rounded-lg font-semibold text-white hover:shadow-lg transition-all"
          >
            Reservar ahora
          </button>
        </div>
      </header>

      {/* Navbar */}
      <nav
        className={`sticky top-0 z-50 ${
          branding?.dark_mode ? 'bg-gray-800' : 'bg-white'
        } shadow-sm`}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-sm" style={{ color: branding?.primary_color }}>
            {business?.name}
          </span>
          {business?.phone && (
            <a
              href={`tel:${business.phone}`}
              className="text-sm font-medium hover:underline"
              style={{ color: branding?.primary_color }}
            >
              {business.phone}
            </a>
          )}
        </div>
      </nav>

      {/* Contenido adicional */}
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="space-y-16">
          {visibleSections.filter(id => id !== 'hero').map((sectionId) => {
            const section = sections[sectionId];
            return (
              <section
                key={sectionId}
                className={branding?.dark_mode ? 'text-gray-100' : 'text-gray-900'}
              >
                {section.title && (
                  <h2
                    className="text-3xl font-bold mb-6"
                    style={{ color: branding?.primary_color }}
                  >
                    {section.title}
                  </h2>
                )}

                {section.text && (
                  <p className={`text-lg mb-6 leading-relaxed ${
                    branding?.dark_mode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {section.text}
                  </p>
                )}

                {section.image_url && (
                  <img
                    src={section.image_url}
                    alt={section.title}
                    className="w-full h-64 object-cover rounded-lg mb-6"
                  />
                )}

                {sectionId === 'services' && children}
              </section>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`px-6 py-12 border-t ${
          branding?.dark_mode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className="max-w-6xl mx-auto text-center">
          <p className={branding?.dark_mode ? 'text-gray-400' : 'text-gray-600'}>
            © 2024 {business?.name}
          </p>
        </div>
      </footer>
    </div>
  );
}
