export default function TemplatePreview({ template, branding, sections, sectionOrder }) {
  const getCSSVars = () => {
    const vars = {
      '--primary-color': branding.primary_color || '#1a5490',
      '--secondary-color': branding.secondary_color || '#2c5aa0',
      '--font-family': getFontFamily(branding.font_family),
    };
    return Object.entries(vars)
      .map(([key, value]) => `${key}: ${value}`)
      .join(';');
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
      className={`border border-gray-300 rounded-lg overflow-hidden h-full flex flex-col ${
        branding.dark_mode ? 'bg-gray-900' : 'bg-white'
      }`}
      style={{
        cssText: getCSSVars(),
        fontFamily: getFontFamily(branding.font_family)
      }}
    >
      {/* Header con logo */}
      <div
        className={`px-8 py-6 border-b ${
          branding.dark_mode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}
        style={{ backgroundColor: branding.primary_color || '#1a5490' }}
      >
        <div className={`flex items-center justify-${getLogoPosition(branding.logo_position)}`}>
          {branding.logo_url && (
            <img
              src={branding.logo_url}
              alt="Logo"
              className="h-10 object-contain"
            />
          )}
          {!branding.logo_url && (
            <div className="text-white font-bold text-lg">Logo</div>
          )}
        </div>
      </div>

      {/* Contenido de secciones */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {visibleSections.length === 0 ? (
          <div className={`text-center py-12 ${branding.dark_mode ? 'text-gray-400' : 'text-gray-500'}`}>
            <p className="text-sm">Activa secciones para ver preview</p>
          </div>
        ) : (
          visibleSections.map(sectionId => {
            const section = sections[sectionId];
            return (
              <div key={sectionId} className="space-y-3">
                {section.title && (
                  <h2
                    className={`text-2xl font-bold ${
                      branding.dark_mode ? 'text-white' : 'text-gray-900'
                    }`}
                    style={{ color: branding.primary_color }}
                  >
                    {section.title}
                  </h2>
                )}

                {section.bg_image_url && (
                  <img
                    src={section.bg_image_url}
                    alt=""
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}

                {section.text && (
                  <p
                    className={`text-sm leading-relaxed ${
                      branding.dark_mode ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {section.text}
                  </p>
                )}

                {section.image_url && (
                  <img
                    src={section.image_url}
                    alt=""
                    className="w-full h-40 object-cover rounded-lg"
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function getLogoPosition(position) {
  const positions = {
    left: 'start',
    center: 'center',
    right: 'end'
  };
  return positions[position] || 'start';
}
