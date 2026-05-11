// Validar color hex
export function isValidHexColor(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// Validar URL
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const urlObj = new URL(url);
    // Solo permitir http, https
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

// Validar estructura de branding
export function validateBranding(branding) {
  if (!branding || typeof branding !== 'object') return false;

  if (branding.primary_color && !isValidHexColor(branding.primary_color)) {
    throw new Error('Color primario inválido');
  }

  if (branding.secondary_color && !isValidHexColor(branding.secondary_color)) {
    throw new Error('Color secundario inválido');
  }

  if (branding.logo_url && !isValidUrl(branding.logo_url)) {
    throw new Error('URL del logo inválida');
  }

  return true;
}

// Validar estructura de section
export function validateSection(section) {
  if (!section || typeof section !== 'object') return false;

  if (section.image_url && !isValidUrl(section.image_url)) {
    throw new Error('URL de imagen inválida');
  }

  if (section.bg_image_url && !isValidUrl(section.bg_image_url)) {
    throw new Error('URL de imagen de fondo inválida');
  }

  return true;
}

// Obtener familia de fuente basada en ID
export function getFontFamily(fontId) {
  const fonts = {
    inter: "'Inter', sans-serif",
    poppins: "'Poppins', sans-serif",
    roboto: "'Roboto', sans-serif",
    playfair: "'Playfair Display', serif"
  };
  return fonts[fontId] || fonts.inter;
}
