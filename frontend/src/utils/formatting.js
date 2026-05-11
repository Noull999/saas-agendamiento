// Validate hex color format
export function validateHexColor(color) {
  if (!color) return false;
  return /^#[0-9A-F]{6}$/i.test(color);
}

// Validate URL (basic check - no file:// or data: URLs)
export function validateImageUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Get font family from ID
export function getFontFamily(fontId = 'inter') {
  const fonts = {
    inter: "'Inter', sans-serif",
    poppins: "'Poppins', sans-serif",
    roboto: "'Roboto', sans-serif",
    playfair: "'Playfair Display', serif",
    lora: "'Lora', serif",
  };
  return fonts[fontId] || fonts.inter;
}

// Format phone number (basic)
export function formatPhone(phone = '') {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  return cleaned;
}

// Format currency
export function formatCurrency(amount, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// Format date to readable string
export function formatDate(dateString) {
  if (!dateString) return '';
  try {
    return new Intl.DateTimeFormat('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

// Get initials from name
export function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Safe data access with fallbacks
export function safeGet(obj, path, defaultValue = null) {
  if (!obj || typeof obj !== 'object') return defaultValue;
  try {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current == null) return defaultValue;
      current = current[key];
    }
    return current != null ? current : defaultValue;
  } catch {
    return defaultValue;
  }
}
