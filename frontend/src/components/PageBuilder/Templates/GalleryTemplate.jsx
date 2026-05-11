export default function GalleryTemplate({ business, branding, sections, sectionOrder, children }) {
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
      style={{ fontFamily: getFontFamily(branding?.font_family) }}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-40 shadow-md px-6 py-4 ${
          branding?.dark_mode ? 'bg-gray-800' : 'bg-white'
        }`}
        style={{ borderBottom: `4px solid ${branding?.primary_color || '#a855f7'}` }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding?.logo_url && (
              <img src={branding.logo_url} alt="Logo" className="h-10 object-contain" />
            )}
            <div>
              <h1 className={`font-bold text-lg ${
                branding?.dark_mode ? 'text-white' : 'text-gray-900'
              }`}>
                {business?.name}
              </h1>
            </div>
          </div>

          {business?.phone && (
            <a
              href={`tel:${business.phone}`}
              className="px-4 py-2 rounded-lg font-medium text-white transition-all hover:shadow-lg"
              style={{ backgroundColor: branding?.primary_color || '#a855f7' }}
            >
              Contactar
            </a>
          )}
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-20">
          {visibleSections.map((sectionId) => {
            const section = sections[sectionId];

            return (
              <section key={sectionId}>
                {/* Título de sección */}
                {section.title && (
                  <div className="mb-12">
                    <h2
                      className="text-4xl font-bold"
                      style={{ color: branding?.primary_color }}
                    >
                      {section.title}
                    </h2>
                    {section.text && (
                      <p className={`mt-4 text-lg ${
                        branding?.dark_mode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {section.text}
                      </p>
                    )}
                  </div>
                )}

                {/* Galería de imágenes */}
                {sectionId === 'gallery' && section.image_url && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {/* Dummy gallery items - can be extended with actual service images */}
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                      <div
                        key={item}
                        className="aspect-square overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow"
                      >
                        <img
                          src={section.image_url}
                          alt={`Galería ${item}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Imagen destacada */}
                {section.image_url && sectionId !== 'gallery' && (
                  <img
                    src={section.image_url}
                    alt={section.title}
                    className="w-full h-80 object-cover rounded-lg shadow-lg mb-8"
                  />
                )}

                {/* Imagen de fondo */}
                {section.bg_image_url && (
                  <div
                    className="w-full h-96 rounded-lg mb-8 bg-cover bg-center shadow-lg relative"
                    style={{ backgroundImage: `url(${section.bg_image_url})` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-lg"></div>
                  </div>
                )}

                {/* Servicios */}
                {sectionId === 'services' && children}
              </section>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`mt-16 px-6 py-12 ${
          branding?.dark_mode ? 'bg-gray-800' : 'bg-gray-50'
        }`}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className={`font-semibold mb-2 ${
                branding?.dark_mode ? 'text-white' : 'text-gray-900'
              }`}>
                Contacto
              </h3>
              {business?.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className={`text-sm hover:underline ${
                    branding?.dark_mode ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {business.phone}
                </a>
              )}
            </div>
            <div>
              <h3 className={`font-semibold mb-2 ${
                branding?.dark_mode ? 'text-white' : 'text-gray-900'
              }`}>
                {business?.name}
              </h3>
              {business?.specialty && (
                <p className={`text-sm ${
                  branding?.dark_mode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {business.specialty}
                </p>
              )}
            </div>
            <div>
              <h3 className={`font-semibold mb-2 ${
                branding?.dark_mode ? 'text-white' : 'text-gray-900'
              }`}>
                Horarios
              </h3>
              <p className={`text-sm ${
                branding?.dark_mode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Consulta disponibilidad
              </p>
            </div>
          </div>

          <div className={`text-center text-sm border-t pt-8 ${
            branding?.dark_mode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'
          }`}>
            <p>© 2024 {business?.name}. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
