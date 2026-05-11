import { useState, useEffect } from 'react';
import axios from 'axios';
import TemplateSelector from './TemplateSelector';

axios.defaults.timeout = 10000;
import BrandingPanel from './BrandingPanel';
import ContentEditor from './ContentEditor';
import SectionManager from './SectionManager';
import TemplatePreview from './TemplatePreview';

export default function ThemeBuilder() {
  const [selectedTemplate, setSelectedTemplate] = useState('modern_minimal');
  const [branding, setBranding] = useState({
    logo_url: '',
    primary_color: '#1a5490',
    secondary_color: '#2c5aa0',
    font_family: 'inter',
    dark_mode: false,
    logo_position: 'left'
  });

  const [sections, setSections] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load current config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/page-builder/config');
      const config = response.data;

      if (config.template_id) setSelectedTemplate(config.template_id);
      if (config.branding) setBranding(config.branding);
      if (config.sections) setSections(config.sections);
    } catch (err) {
      setError('Error cargando configuración');
      console.error(err);
      initializeDefaultSections();
    } finally {
      setIsLoading(false);
    }
  };

  const initializeDefaultSections = () => {
    setSections({
      hero: { enabled: true, title: 'Bienvenido', text: 'Tu servicio aquí', image_url: '' },
      services: { enabled: true, title: 'Servicios', layout: 'grid', columns: 3, show_price: true, show_description: true },
      testimonials: { enabled: false, title: 'Testimonios', layout: 'carousel', columns: 1 },
      footer: { enabled: true, title: 'Contacto', text: 'Déjanos un mensaje' },
      section_order: ['hero', 'services', 'testimonials', 'footer']
    });
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
  };

  const handleBrandingUpdate = (newBranding) => {
    setBranding(newBranding);
  };

  const handleSectionsUpdate = (newSections) => {
    setSections(newSections);
  };

  const handleSectionReorder = (newOrder) => {
    setSections({
      ...sections,
      section_order: newOrder
    });
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await axios.patch('/api/page-builder/config', {
        template_id: selectedTemplate,
        branding,
        sections
      });

      setSuccessMessage('Configuración guardada exitosamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando configuración');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Cargando configuración...</div>
      </div>
    );
  }

  const sectionOrder = sections.section_order || Object.keys(sections).filter(k => k !== 'section_order');

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Constructor de Página</h1>
          <p className="text-gray-600">Personaliza tu página de reservas con templates y estilos</p>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        {/* Contenedor principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel izquierdo - Editor */}
          <div className="lg:col-span-1 space-y-6 max-h-screen overflow-y-auto">
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onSelectTemplate={handleTemplateSelect}
              isLoading={isSaving}
            />

            <BrandingPanel
              branding={branding}
              onUpdate={handleBrandingUpdate}
            />

            <ContentEditor
              sections={sections}
              onUpdate={handleSectionsUpdate}
            />

            <SectionManager
              sections={sections}
              onReorder={handleSectionReorder}
            />

            {/* Botón guardar */}
            <button
              onClick={saveConfig}
              disabled={isSaving}
              className={`w-full py-3 rounded-lg font-medium text-white transition-all ${
                isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
              }`}
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>

          {/* Panel derecho - Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: '80vh' }}>
              <TemplatePreview
                template={selectedTemplate}
                branding={branding}
                sections={sections}
                sectionOrder={sectionOrder}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
