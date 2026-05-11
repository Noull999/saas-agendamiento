export default function ContentEditor({ sections, onUpdate }) {
  const handleChange = (sectionId, field, value) => {
    onUpdate({
      ...sections,
      [sectionId]: {
        ...sections[sectionId],
        [field]: value
      }
    });
  };

  const handleToggle = (sectionId) => {
    onUpdate({
      ...sections,
      [sectionId]: {
        ...sections[sectionId],
        enabled: !sections[sectionId].enabled
      }
    });
  };

  return (
    <div className="space-y-4 bg-gray-50 p-6 rounded-xl max-h-96 overflow-y-auto">
      <h3 className="font-bold text-gray-900 sticky top-0 bg-gray-50 py-2">Contenido de Secciones</h3>

      {Object.entries(sections).map(([sectionId, section]) => {
        if (sectionId === 'section_order') return null;

        return (
          <div key={sectionId} className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900 capitalize">
                {sectionId.replace(/_/g, ' ')}
              </h4>
              <input
                type="checkbox"
                checked={section.enabled || false}
                onChange={() => handleToggle(sectionId)}
                className="w-4 h-4 cursor-pointer"
                title={section.enabled ? 'Ocultar' : 'Mostrar'}
              />
            </div>

            {section.enabled && (
              <div className="space-y-2 text-sm">
                {section.title && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Título</label>
                    <input
                      type="text"
                      value={section.title || ''}
                      onChange={(e) => handleChange(sectionId, 'title', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {section.text && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Descripción</label>
                    <textarea
                      value={section.text || ''}
                      onChange={(e) => handleChange(sectionId, 'text', e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                )}

                {section.image_url && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600">URL de Imagen</label>
                    <input
                      type="url"
                      value={section.image_url || ''}
                      onChange={(e) => handleChange(sectionId, 'image_url', e.target.value)}
                      placeholder="https://..."
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {section.bg_image_url && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Imagen de Fondo</label>
                    <input
                      type="url"
                      value={section.bg_image_url || ''}
                      onChange={(e) => handleChange(sectionId, 'bg_image_url', e.target.value)}
                      placeholder="https://..."
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {section.layout && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Layout</label>
                    <select
                      value={section.layout || 'grid'}
                      onChange={(e) => handleChange(sectionId, 'layout', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="grid">Grid</option>
                      <option value="list">Lista</option>
                      <option value="carousel">Carrusel</option>
                    </select>
                  </div>
                )}

                {typeof section.columns !== 'undefined' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Columnas</label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={section.columns || 3}
                      onChange={(e) => handleChange(sectionId, 'columns', parseInt(e.target.value))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {typeof section.show_price !== 'undefined' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={section.show_price || false}
                      onChange={(e) => handleChange(sectionId, 'show_price', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-gray-700">Mostrar precios</span>
                  </label>
                )}

                {typeof section.show_description !== 'undefined' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={section.show_description || false}
                      onChange={(e) => handleChange(sectionId, 'show_description', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-gray-700">Mostrar descripciones</span>
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
