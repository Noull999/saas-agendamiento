import { getFontFamily } from '../../../utils/validation';

export default function ModernMinimalTemplate({ business, branding, sections, sectionOrder, children }) {
  if (!business || typeof business !== 'object') {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Datos de negocio inválidos</div>;
  }

  if (!sections || typeof sections !== 'object') {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Secciones no configuradas</div>;
  }

  const getCSSVars = () => {
    return {
      '--primary-color': branding?.primary_color || '#1a5490',
      '--secondary-color': branding?.secondary_color || '#2c5aa0',
      '--font-family': getFontFamily(branding?.font_family),
    };
  };

  const visibleSections = Array.isArray(sectionOrder) ? sectionOrder.filter(id => sections[id]?.enabled) : [];

  return (
    <div
      className={`min-h-screen ${branding?.dark_mode ? 'bg-gray-900' : 'bg-white'}`}
      style={getCSSVars()}
    >
      {/* Header */}
      <header
        className="px-6 py-8 md:py-12 border-b"
        style={{
          backgroundColor: branding?.primary_color || '#1a5490',
          borderColor: branding?.secondary_color || '#2c5aa0'
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding?.logo_url && (
              <img
                src={branding.logo_url}
                alt="Logo"
                className="h-12 object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div className="text-white">
              <h1 className="text-2xl font-bold">{business?.name}</h1>
              {business?.specialty && (
                <p className="text-sm opacity-90">{business.specialty}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-16">
          {visibleSections.map((sectionId) => {
            const section = sections[sectionId];
            return (
              <section
                key={sectionId}
                className={`${
                  branding?.dark_mode ? 'text-gray-100' : 'text-gray-900'
                }`}
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
                    loading="lazy"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}

                {section.bg_image_url && typeof section.bg_image_url === 'string' && section.bg_image_url.trim() && (
                  <div
                    className="w-full h-80 rounded-lg mb-6 bg-cover bg-center"
                    style={{ backgroundImage: `url('${section.bg_image_url}')` }}
                  />
                )}

                {/* Renderizar contenido dinámico según tipo de sección */}
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
            {business?.phone && (
              <>
                <a href={`tel:${business.phone}`} className="hover:underline">
                  {business.phone}
                </a>
              </>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
