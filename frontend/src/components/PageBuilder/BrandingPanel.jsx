import { useState } from 'react';
import { isValidHexColor, isValidUrl } from '../../utils/validation';

export default function BrandingPanel({ branding, onUpdate }) {
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    const newErrors = { ...errors };

    // Validar por campo
    if (field === 'primary_color' || field === 'secondary_color') {
      if (value && !isValidHexColor(value)) {
        newErrors[field] = 'Formato de color inválido (ej: #1a5490)';
      } else {
        delete newErrors[field];
      }
    }

    if (field === 'logo_url') {
      if (value && !isValidUrl(value)) {
        newErrors[field] = 'URL inválida o insegura';
      } else {
        delete newErrors[field];
      }
    }

    setErrors(newErrors);

    // Solo actualizar si no hay errores
    if (Object.keys(newErrors).length === 0) {
      onUpdate({
        ...branding,
        [field]: value
      });
    }
  };

  const fonts = [
    { id: 'inter', name: 'Inter (Modern)' },
    { id: 'poppins', name: 'Poppins (Friendly)' },
    { id: 'roboto', name: 'Roboto (Clean)' },
    { id: 'playfair', name: 'Playfair (Elegant)' }
  ];

  const colorOptions = [
    '#1a5490', '#2c5aa0', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
  ];

  return (
    <div className="space-y-6 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">🎨 Marca & Estilos</h3>
        <p className="text-gray-600 text-sm mt-1">Personaliza los colores y elementos visuales</p>
      </div>

      {/* Logo */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-3">Logo</label>
        <input
          type="url"
          placeholder="https://ejemplo.com/logo.png"
          value={branding.logo_url || ''}
          onChange={(e) => handleChange('logo_url', e.target.value)}
          className={`w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            errors.logo_url ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
          }`}
        />
        {errors.logo_url && (
          <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
            <span>⚠️</span> {errors.logo_url}
          </p>
        )}
        {!errors.logo_url && (
          <p className="text-sm text-gray-500 mt-2">💡 Usa una imagen PNG transparente para mejor resultado</p>
        )}
        {branding.logo_url && !errors.logo_url && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center h-20">
            <img src={branding.logo_url} alt="Logo preview" className="max-h-16 max-w-32" onError={() => {}} />
          </div>
        )}
      </div>

      {/* Colores */}
      <div className="space-y-4 pt-4 border-t border-gray-100">
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-3">Color Principal</label>
          <div className="flex gap-3 flex-wrap">
            {colorOptions.map((color) => (
              <button
                key={color}
                onClick={() => handleChange('primary_color', color)}
                className={`w-12 h-12 rounded-lg border-2 transition-all shadow-sm ${
                  branding.primary_color === color
                    ? 'border-gray-900 shadow-lg scale-110'
                    : 'border-gray-300 hover:border-gray-500'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <input
            type="text"
            placeholder="#1a5490"
            value={branding.primary_color || '#1a5490'}
            onChange={(e) => handleChange('primary_color', e.target.value)}
            className={`w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-3 transition-colors ${
              errors.primary_color ? 'border-red-400 bg-red-50' : 'border-gray-200'
            }`}
          />
          {errors.primary_color && <p className="text-sm text-red-600 mt-2">⚠️ {errors.primary_color}</p>}
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-3">Color Secundario</label>
          <input
            type="text"
            placeholder="#2c5aa0"
            value={branding.secondary_color || '#2c5aa0'}
            onChange={(e) => handleChange('secondary_color', e.target.value)}
            className={`w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              errors.secondary_color ? 'border-red-400 bg-red-50' : 'border-gray-200'
            }`}
          />
          {errors.secondary_color && <p className="text-sm text-red-600 mt-2">⚠️ {errors.secondary_color}</p>}
        </div>
      </div>

      {/* Fuente */}
      <div className="pt-4 border-t border-gray-100">
        <label className="text-sm font-semibold text-gray-700 block mb-3">📝 Fuente</label>
        <select
          value={branding.font_family || 'inter'}
          onChange={(e) => handleChange('font_family', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-colors"
        >
          {fonts.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Dark Mode */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div>
          <label className="text-sm font-semibold text-gray-700">🌙 Modo Oscuro</label>
          <p className="text-xs text-gray-500 mt-1">Activar tema oscuro</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={branding.dark_mode || false}
            onChange={(e) => handleChange('dark_mode', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Posición del Logo */}
      <div className="pt-4 border-t border-gray-100">
        <label className="text-sm font-semibold text-gray-700 block mb-3">📍 Posición del Logo</label>
        <div className="flex gap-2">
          {['left', 'center', 'right'].map((pos) => (
            <button
              key={pos}
              onClick={() => handleChange('logo_position', pos)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                branding.logo_position === pos
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400'
              }`}
            >
              {pos === 'left' && '← Izq'}
              {pos === 'center' && '↔ Centro'}
              {pos === 'right' && 'Der →'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
