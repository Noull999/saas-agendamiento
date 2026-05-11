import { useState, useEffect } from 'react';
import axios from 'axios';

export default function TemplateSelector({ selectedTemplate, onSelectTemplate, isLoading }) {
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/page-builder/templates')
      .then(({ data }) => setTemplates(data))
      .catch(() => setError('Error al cargar templates'));
  }, []);

  const getTemplateIcon = (templateId) => {
    const icons = {
      modern_minimal: '▢',
      full_width: '━',
      hero_focus: '◉',
      gallery_style: '◊',
      luxury_premium: '✦'
    };
    return icons[templateId] || '◻';
  };

  const getTemplateBg = (templateId) => {
    const colors = {
      modern_minimal: 'from-blue-50 to-blue-100',
      full_width: 'from-green-50 to-green-100',
      hero_focus: 'from-pink-50 to-pink-100',
      gallery_style: 'from-purple-50 to-purple-100',
      luxury_premium: 'from-gray-900 to-gray-800'
    };
    return colors[templateId] || 'from-gray-50 to-gray-100';
  };

  const getTemplateTextColor = (templateId) => {
    return templateId === 'luxury_premium' ? 'text-white' : 'text-gray-900';
  };

  if (error) return <div className="text-red-500 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Elige tu diseño</h2>
      <p className="text-sm text-gray-600">Selecciona una de nuestras 5 plantillas profesionales</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {templates.map((template) => (
          <button
            key={template.template_id}
            onClick={() => onSelectTemplate(template.template_id)}
            disabled={isLoading}
            className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
              selectedTemplate === template.template_id
                ? 'border-indigo-600 shadow-lg'
                : 'border-gray-200 hover:border-indigo-400'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Fondo visual del template */}
            <div className={`bg-gradient-to-br ${getTemplateBg(template.template_id)} p-6 aspect-square flex flex-col items-center justify-center`}>
              <div className={`text-4xl mb-2 ${getTemplateTextColor(template.template_id)}`}>
                {getTemplateIcon(template.template_id)}
              </div>
              <div className={`text-xs font-bold text-center ${getTemplateTextColor(template.template_id)}`}>
                {template.name}
              </div>
            </div>

            {/* Checkmark si está seleccionado */}
            {selectedTemplate === template.template_id && (
              <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                ✓
              </div>
            )}

            {/* Tooltip con descripción */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/90 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity max-h-20 overflow-hidden">
              {template.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
