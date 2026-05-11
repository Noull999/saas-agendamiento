export default function FullWidthTemplate({ business, branding, sections, sectionOrder, children }) {
  const getCSSVars = () => {
    return {
      '--primary-color': branding?.primary_color || '#10b981',
      '--secondary-color': branding?.secondary_color || '#059669',
      '--font-family': getFontFamily(branding?.font_family),
    };
  };

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
      className={branding?.dark_mode ? 'bg-gray-900' : 'bg-white'}
      style={getCSSVars()}
    >
      {/* Hero Header Full Width */}
      <header
        className="relative w-full py-20 md:py-32 text-white overflow-hidden"
        style={{
          backgroundColor: branding?.primary_color || '#10b981'
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-white"></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-6 mb-8">
            {branding?.logo_url && (
              <img src={branding.logo_url} alt="Logo" className="h-16 object-contain filter brightness-0 invert" />
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">{business?.name}</h1>
          {business?.specialty && (
            <p className="text-xl opacity-90">{business.specialty}</p>
          )}
        </div>
      </header>

      {/* Contenido Full Width Sections */}
      <main>
        {visibleSections.map((sectionId) => {
          const section = sections[sectionId];

          if (section.bg_image_url) {
            return (
              <section
                key={sectionId}
                className="w-full py-16 md:py-24 relative text-white"
                style={{
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${section.bg_image_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="max-w-6xl mx-auto px-6">
                  {section.title && (
                    <h2 className="text-3xl font-bold mb-4">{section.title}</h2>
                  )}
                  {section.text && (
                    <p className="text-lg opacity-90 max-w-2xl">{section.text}</p>
                  )}
                  {sectionId === 'services' && children}
                </div>
              </section>
            );
          }

          return (
            <section
              key={sectionId}
              className={`w-full py-16 md:py-24 ${
                visibleSections.indexOf(sectionId) % 2 === 1
                  ? branding?.dark_mode ? 'bg-gray-800' : 'bg-gray-50'
                  : branding?.dark_mode ? 'bg-gray-900' : 'bg-white'
              }`}
            >
              <div className="max-w-6xl mx-auto px-6">
                {section.title && (
                  <h2
                    className="text-3xl font-bold mb-6"
                    style={{ color: branding?.primary_color }}
                  >
                    {section.title}
                  </h2>
                )}

                {section.text && (
                  <p className={`text-lg mb-6 leading-relaxed max-w-2xl ${
                    branding?.dark_mode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {section.text}
                  </p>
                )}

                {section.image_url && (
                  <img
                    src={section.image_url}
                    alt={section.title}
                    className="w-full h-80 object-cover rounded-lg"
                  />
                )}

                {sectionId === 'services' && children}
              </div>
            </section>
          );
        })}
      </main>

      {/* Full Width Footer */}
      <footer
        className="w-full py-12 text-white"
        style={{
          backgroundColor: branding?.secondary_color || '#059669'
        }}
      >
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="opacity-90">
            {business?.phone && (
              <a href={`tel:${business.phone}`} className="hover:opacity-100">
                {business.phone}
              </a>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
