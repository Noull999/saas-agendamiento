const router = require('express').Router();
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

// Helper: Validar estructura de page_config
function validatePageConfig(config) {
  if (!config || typeof config !== 'object') return true;

  const maxDepth = (obj, depth = 0) => {
    if (depth > 5) throw new Error('page_config demasiado profundo');
    if (typeof obj !== 'object' || !obj) return depth;
    return Math.max(...Object.values(obj).map(v => maxDepth(v, depth + 1)));
  };

  try {
    maxDepth(config);
    const jsonStr = JSON.stringify(config);
    if (jsonStr.length > 100000) throw new Error('page_config demasiado grande');
  } catch (err) {
    throw new Error(`Configuración inválida: ${err.message}`);
  }
}

// GET: Listar templates disponibles
router.get('/templates', (req, res) => {
  try {
    const templates = db.prepare(
      'SELECT template_id, name, description FROM page_templates ORDER BY id'
    ).all();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener templates' });
  }
});

// GET: Obtener configuración actual del usuario
router.get('/config', authMiddleware, (req, res) => {
  try {
    const business = db.prepare(
      'SELECT template_id, page_config FROM businesses WHERE id = ?'
    ).get(req.business.id);

    if (!business) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    let pageConfig = {};
    if (business.page_config) {
      try {
        pageConfig = JSON.parse(business.page_config);
      } catch (err) {
        console.error('Error parsing page_config:', err);
        // Retornar configuración vacía si JSON está corrupto
        pageConfig = {};
      }
    }

    res.json({
      template_id: business.template_id || 'modern_minimal',
      page_config: pageConfig
    });
  } catch (err) {
    console.error('Error en GET /config:', err);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// PATCH: Actualizar configuración del usuario
router.patch('/config', authMiddleware, (req, res) => {
  try {
    const { template_id, page_config } = req.body;

    if (!template_id) {
      return res.status(400).json({ error: 'template_id es requerido' });
    }

    // Validar que el template existe
    const templateExists = db.prepare(
      'SELECT id FROM page_templates WHERE template_id = ?'
    ).get(template_id);

    if (!templateExists) {
      return res.status(400).json({ error: 'Template no válido' });
    }

    // Validar page_config
    try {
      validatePageConfig(page_config);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Actualizar
    db.prepare(
      'UPDATE businesses SET template_id = ?, page_config = ? WHERE id = ?'
    ).run(template_id, JSON.stringify(page_config || {}), req.business.id);

    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (err) {
    console.error('Error en PATCH /config:', err);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

module.exports = router;
