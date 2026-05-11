import { useState, useEffect, useCallback, useMemo } from 'react';
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

  const loadConfig = async (retryCount = 0) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.get('/api/page-builder/config');
      const config = response.data;

      if (config.template_id) setSelectedTemplate(config.template_id);
      if (config.branding) setBranding(config.branding);
      if (config.sections) setSections(config.sections);
    } catch (err) {
      const maxRetries = 3;
      const isNetworkError = !err.response || err.code === 'ECONNABORTED';

      if (isNetworkError && retryCount < maxRetries) {
        const delayMs = Math.pow(2, retryCount) * 1000;
        setTimeout(() => loadConfig(retryCount + 1), delayMs);
        if (retryCount === 0) {
          setError('Reintentando conexión...');
        }
      } else {
        let errorMsg = 'Error cargando configuración';
        if (err.response?.status === 401) {
          errorMsg = 'No autorizado. Por favor inicia sesión nuevamente';
        } else if (err.response?.status === 404) {
          errorMsg = 'Configuración no encontrada. Se usarán valores por defecto';
        } else if (isNetworkError) {
          errorMsg = 'Error de conexión. Verifica tu conexión a internet';
        } else if (err.response?.data?.error) {
          errorMsg = err.response.data.error;
        }
        setError(errorMsg);
        console.error('Config load error:', err);
        initializeDefaultSections();
      }
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

  const handleTemplateSelect = useCallback((templateId) => {
    setSelectedTemplate(templateId);
  }, []);

  const handleBrandingUpdate = useCallback((newBranding) => {
    setBranding(newBranding);
  }, []);

  const handleSectionsUpdate = useCallback((newSections) => {
    setSections(newSections);
  }, []);

  const handleSectionReorder = useCallback((newOrder) => {
    setSections((prev) => ({
      ...prev,
      section_order: newOrder
    }));
  }, []);

  const saveConfig = useCallback(async () => {
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
      let errorMsg = 'Error guardando configuración';

      if (err.response?.status === 400) {
        errorMsg = err.response.data?.error || 'Configuración inválida. Verifica los datos y vuelve a intentar';
      } else if (err.response?.status === 401) {
        errorMsg = 'Tu sesión ha expirado. Por favor inicia sesión nuevamente';
      } else if (err.code === 'ECONNABORTED') {
        errorMsg = 'Tiempo de conexión agotado. Verifica tu conexión e intenta nuevamente';
      } else if (!err.response) {
        errorMsg = 'Error de conexión. Verifica tu conexión a internet';
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      }

      setError(errorMsg);
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [selectedTemplate, branding, sections]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  const sectionOrder = sections.section_order || Object.keys(sections).filter(k => k !== 'section_order');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 mb-8">
          <h1 className="text-4xl font-bold mb-2">Constructor de Página</h1>
          <p className="text-blue-100">Personaliza tu página de reservas con templates y estilos premium</p>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 rounded-lg text-red-700 text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-600 rounded-lg text-green-700 text-sm">
            <span className="font-semibold">✓ Éxito:</span> {successMessage}
          </div>
        )}

        {/* Contenedor principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-6 pb-12">
          {/* Panel izquierdo - Editor */}
          <div className="lg:col-span-1 space-y-6">
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
              className={`w-full py-3 rounded-lg font-semibold text-white transition-all transform ${
                isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:scale-95'
              }`}
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Guardando...
                </span>
              ) : (
                '💾 Guardar Cambios'
              )}
            </button>
          </div>

          {/* Panel derecho - Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden" style={{ height: '80vh' }}>
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
