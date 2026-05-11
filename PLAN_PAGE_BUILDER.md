# 📐 PLAN: PAGE BUILDER HÍBRIDO CON 5 TEMPLATES

## 🎯 Objetivo
Permitir que cada usuario personalice completamente el diseño de su página pública:
- Elegir entre 5 templates diferentes
- Personalizar colores, fuentes, imágenes
- Reordenar secciones (drag-drop)
- Vista previa en vivo
- Resultado: página única y profesional

---

## 📋 LOS 5 TEMPLATES

### **Template 1: MODERN MINIMAL**
- 2 columnas (sidebar + contenido)
- Limpio, profesional, moderno
- Ideal para: Consultorías, coaches, servicios profesionales
- Estructura:
  - Hero Section (con logo + descripción)
  - Servicios (lista o cards)
  - Información de contacto
  - Footer

### **Template 2: FULL WIDTH FLOW**
- Una sola columna, fluida
- Secciones que ocupan 100% del ancho
- Ideal para: Clínicas, médicos, veterinarias
- Estructura:
  - Hero grande
  - Cards de servicios (grid 2-3 columnas)
  - About/Sobre nosotros
  - Testimonios
  - CTA final + Footer

### **Template 3: HERO FOCUS**
- Imagen hero grande y llamativa
- Servicios en cards abajo
- Ideal para: Salones de belleza, spas
- Estructura:
  - Hero con imagen/video
  - Título + descripción
  - Grid de servicios (3+ columnas)
  - Features/Beneficios
  - Footer

### **Template 4: GALLERY STYLE**
- Galería visual de servicios
- Diseño moderno tipo Pinterest
- Ideal para: Fotografía, diseño, creativo
- Estructura:
  - Hero simple
  - Masonry grid de servicios
  - Galería de fotos
  - Información contacto
  - Footer

### **Template 5: LUXURY PREMIUM**
- Diseño elegante y sofisticado
- Fondo oscuro o gradiente
- Ideal para: Lujo, spa premium, servicios high-end
- Estructura:
  - Hero elegante con overlay
  - Servicios en layout premium
  - Sección "sobre nosotros"
  - Galería
  - Testimonios
  - Footer elegante

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS

### **Nueva Tabla: `page_templates`**
```sql
CREATE TABLE page_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id TEXT UNIQUE,           -- 'modern_minimal', 'full_width', etc
  name TEXT,                         -- 'Modern Minimal'
  description TEXT,
  default_config JSON,               -- Configuración por defecto
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Modificar Tabla: `businesses`**
```sql
ALTER TABLE businesses ADD COLUMN (
  template_id TEXT DEFAULT 'modern_minimal',
  page_config JSON                   -- Personalización del usuario
);

-- page_config structure:
{
  "template_id": "modern_minimal",
  "branding": {
    "logo_url": "https://...",
    "primary_color": "#1a5490",
    "secondary_color": "#2c5aa0",
    "accent_color": "#10b981",
    "font_family": "inter",           -- inter, poppins, roboto, playfair
    "dark_mode": false,
    "logo_position": "left"           -- left, center, right
  },
  "sections": {
    "hero": {
      "title": "Mi Negocio",
      "subtitle": "Reserva online",
      "description": "Texto de bienvenida",
      "bg_image_url": "https://...",
      "bg_color": "#ffffff",
      "text_color": "#333333",
      "show_logo": true,
      "enabled": true,
      "height": "large"               -- small, medium, large
    },
    "services": {
      "title": "Nuestros Servicios",
      "layout": "grid",               -- grid, list, carousel
      "columns": 3,
      "show_price": true,
      "show_description": true,
      "enabled": true
    },
    "about": {
      "title": "Sobre Nosotros",
      "text": "Descripción...",
      "image_url": "https://...",
      "bg_color": "#f5f5f5",
      "enabled": true
    },
    "testimonials": {
      "title": "Lo que dicen nuestros clientes",
      "enabled": false
    },
    "contact": {
      "title": "Contacto",
      "show_phone": true,
      "show_email": true,
      "show_location": true,
      "enabled": true
    },
    "footer": {
      "text": "© 2024 Mi Negocio",
      "show_socials": true,
      "enabled": true
    }
  },
  "section_order": ["hero", "services", "about", "contact", "footer"]
}
```

---

## 💻 ARQUITECTURA FRONTEND

### **Nuevas Páginas/Componentes**

#### **1. Dashboard → ThemeBuilder**
```
src/pages/ThemeBuilder.jsx (NUEVA)
├─ TemplateSelector (elige template)
├─ ThemeEditor (personaliza)
│  ├─ BrandingPanel (colores, logo, fuentes)
│  ├─ SectionManager (reordenar, mostrar/ocultar)
│  ├─ ContentEditor (textos, imágenes)
│  └─ PreviewPane (vista en vivo)
└─ PublishButton
```

#### **2. Componente: TemplatePreview**
```
src/components/PageBuilder/TemplatePreview.jsx (NUEVA)
- Renderiza el template dinámicamente
- Lee page_config y aplica estilos
- USA VARIABLES CSS para colores dinámicos
```

#### **3. Modificar: BookingPage.jsx**
```
- Agregar lógica para leer page_config
- Renderizar dinámicamente basado en template_id
- Aplicar estilos personalizados
- Usar CSS variables para colores
```

### **Estructura de Carpetas Nueva**
```
frontend/src/
├─ components/
│  └─ PageBuilder/
│     ├─ TemplateSelector.jsx (NEW)
│     ├─ BrandingPanel.jsx (NEW)
│     ├─ SectionManager.jsx (NEW)
│     ├─ ContentEditor.jsx (NEW)
│     ├─ ColorPicker.jsx (NEW)
│     ├─ TemplatePreview.jsx (NEW)
│     ├─ templates/
│     │  ├─ ModernMinimalTemplate.jsx (NEW)
│     │  ├─ FullWidthTemplate.jsx (NEW)
│     │  ├─ HeroFocusTemplate.jsx (NEW)
│     │  ├─ GalleryTemplate.jsx (NEW)
│     │  └─ LuxuryTemplate.jsx (NEW)
│     └─ styles/
│        └─ templates.css (NEW)
│
└─ pages/
   └─ ThemeBuilder.jsx (NEW)
```

---

## 🔧 ARQUITECTURA BACKEND

### **Nuevos Endpoints API**

```javascript
// GET /api/page-builder/templates
// Retorna lista de 5 templates disponibles

// GET /api/page-builder/config
// Retorna page_config actual del usuario

// PATCH /api/page-builder/config
// Actualiza page_config

// POST /api/page-builder/preview
// Retorna HTML renderizado para vista previa

// GET /api/public/:slug?preview=true
// Retorna página pública con page_config aplicado
```

### **Nueva Ruta: `src/routes/page-builder.routes.js`**
```javascript
const router = require('express').Router();
const db = require('../db/database');

// GET templates disponibles
router.get('/templates', (req, res) => {
  const templates = db.prepare('SELECT * FROM page_templates').all();
  res.json(templates);
});

// GET config actual
router.get('/config', authenticateJWT, (req, res) => {
  const business = db.prepare(
    'SELECT template_id, page_config FROM businesses WHERE id = ?'
  ).get(req.userId);
  
  res.json({
    template_id: business.template_id,
    page_config: JSON.parse(business.page_config || '{}')
  });
});

// PATCH config
router.patch('/config', authenticateJWT, (req, res) => {
  const { template_id, page_config } = req.body;
  
  db.prepare(
    'UPDATE businesses SET template_id = ?, page_config = ? WHERE id = ?'
  ).run(template_id, JSON.stringify(page_config), req.userId);
  
  res.json({ success: true });
});

module.exports = router;
```

---

## 🎨 FLUJO DEL USUARIO

```
1. Usuario en Dashboard
   ↓
2. Haz clic: "Personalizar Página Pública"
   ↓
3. Se abre ThemeBuilder
   ├─ Paso 1: Selecciona template (5 opciones)
   ├─ Paso 2: Personaliza branding (logo, colores, fuentes)
   ├─ Paso 3: Edita contenido (textos, imágenes)
   ├─ Paso 4: Reordena secciones (drag-drop)
   └─ Paso 5: Vista previa en vivo
   ↓
4. Haz clic: "Publicar" o "Guardar cambios"
   ↓
5. Página pública actualizada en: milugar.app/book/:slug
```

---

## 🔌 INTEGRACIÓN CON EXISTENTE

### **BookingPage.jsx**
- Leer `profile.page_config` del endpoint `/api/public/:slug`
- Si no hay `page_config`, usar estilos por defecto
- Renderizar template basado en `template_id`
- Aplicar CSS variables para colores dinámicos

---

## 📊 ESTIMACIÓN DE TIEMPO

| Componente | Tiempo | Prioridad |
|-----------|--------|-----------|
| Modelos BD + Endpoints | 2h | 1 |
| TemplateSelector | 1.5h | 1 |
| BrandingPanel | 2h | 1 |
| SectionManager | 2h | 2 |
| ContentEditor | 2h | 2 |
| Template Components (5) | 5h | 1 |
| TemplatePreview | 2h | 1 |
| BookingPage adapt | 1.5h | 1 |
| CSS/Estilos | 2h | 1 |
| Testing | 2h | 2 |
| **TOTAL** | **~22h** | |

---

## ✅ CHECKLIST IMPLEMENTACIÓN

### **BACKEND (6h)**
- [ ] Crear tabla `page_templates`
- [ ] Modificar tabla `businesses`
- [ ] Crear ruta `/api/page-builder/templates`
- [ ] Crear ruta `/api/page-builder/config`
- [ ] Crear ruta PATCH `/api/page-builder/config`
- [ ] Seed data con 5 templates

### **FRONTEND - Page Builder (10h)**
- [ ] Crear TemplateSelector
- [ ] Crear BrandingPanel (color picker, font selector)
- [ ] Crear SectionManager (drag-drop)
- [ ] Crear ContentEditor
- [ ] Crear TemplatePreview
- [ ] Crear ThemeBuilder page

### **FRONTEND - Templates (5h)**
- [ ] ModernMinimalTemplate
- [ ] FullWidthTemplate
- [ ] HeroFocusTemplate
- [ ] GalleryTemplate
- [ ] LuxuryTemplate

### **FRONTEND - Integration (1h)**
- [ ] Adaptar BookingPage.jsx
- [ ] CSS variables por template
- [ ] Testing en todos los templates

---

## 🎯 RESULTADO FINAL

Cada usuario tendrá:
✅ **Página pública única y profesional**
✅ **Control 100% de diseño**
✅ **Sin necesidad de conocimientos técnicos**
✅ **Sincronización con servicios/horarios automática**
✅ **Vista previa en tiempo real**
✅ **5 templates a elegir**

---

## 🚀 ¿LISTO PARA EMPEZAR?

Próximos pasos:
1. Crear rama git: `git checkout -b feature/page-builder`
2. Implementar backend
3. Implementar frontend
4. Pushear a rama `claude/technical-documentation-5quyN`
