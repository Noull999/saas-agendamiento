import { useState, useEffect } from 'react';
import axios from 'axios';
import { TemplateCard } from '../ui/TemplateCard';

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
    <div className="space-y-6 bg-white rounded-xl p-6 border border-gray-100">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Elige tu diseño</h2>
        <p className="text-gray-600">Selecciona una de nuestras 5 plantillas profesionales</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.template_id}
            template={template}
            isSelected={selectedTemplate === template.template_id}
            onClick={() => !isLoading && onSelectTemplate(template.template_id)}
          >
            <div className={`w-full h-full bg-gradient-to-br ${getTemplateBg(template.template_id)} flex flex-col items-center justify-center`}>
              <div className={`text-5xl mb-3 ${getTemplateTextColor(template.template_id)}`}>
                {getTemplateIcon(template.template_id)}
              </div>
            </div>
          </TemplateCard>
        ))}
      </div>
    </div>
  );
}
