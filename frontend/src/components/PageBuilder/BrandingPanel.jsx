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
    <div className="space-y-6 bg-gray-50 p-6 rounded-xl">
      <h3 className="font-bold text-gray-900">Marca & Estilos</h3>

      {/* Logo */}
      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-2">Logo</label>
        <input
          type="url"
          placeholder="URL de tu logo"
          value={branding.logo_url || ''}
          onChange={(e) => handleChange('logo_url', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <p className="text-xs text-gray-500 mt-1">Usa una imagen PNG transparente para mejor resultado</p>
      </div>

      {/* Colores */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-gray-700">Color Principal</label>
        <div className="flex gap-2 flex-wrap">
          {colorOptions.map((color) => (
            <button
              key={color}
              onClick={() => handleChange('primary_color', color)}
              className={`w-10 h-10 rounded-lg border-2 transition-all ${
                branding.primary_color === color
                  ? 'border-gray-900 shadow-md'
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
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold text-gray-700">Color Secundario</label>
        <input
          type="text"
          placeholder="#2c5aa0"
          value={branding.secondary_color || '#2c5aa0'}
          onChange={(e) => handleChange('secondary_color', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Fuente */}
      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-2">Fuente</label>
        <select
          value={branding.font_family || 'inter'}
          onChange={(e) => handleChange('font_family', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {fonts.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Dark Mode */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700">Modo Oscuro</label>
        <input
          type="checkbox"
          checked={branding.dark_mode || false}
          onChange={(e) => handleChange('dark_mode', e.target.checked)}
          className="rounded w-4 h-4 cursor-pointer"
        />
      </div>

      {/* Posición del Logo */}
      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-2">Posición del Logo</label>
        <div className="flex gap-2">
          {['left', 'center', 'right'].map((pos) => (
            <button
              key={pos}
              onClick={() => handleChange('logo_position', pos)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                branding.logo_position === pos
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-400'
              }`}
            >
              {pos === 'left' && '⟨ Izquierda'}
              {pos === 'center' && '• Centro'}
              {pos === 'right' && 'Derecha ⟩'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
