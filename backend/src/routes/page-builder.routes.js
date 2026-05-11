const router = require('express').Router();
const db = require('../db/database');
const { authenticateJWT } = require('../middleware/auth');

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
router.get('/config', authenticateJWT, (req, res) => {
  try {
    const business = db.prepare(
      'SELECT template_id, page_config FROM businesses WHERE id = ?'
    ).get(req.userId);

    if (!business) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    res.json({
      template_id: business.template_id || 'modern_minimal',
      page_config: business.page_config ? JSON.parse(business.page_config) : {}
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// PATCH: Actualizar configuración del usuario
router.patch('/config', authenticateJWT, (req, res) => {
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

    // Actualizar
    db.prepare(
      'UPDATE businesses SET template_id = ?, page_config = ? WHERE id = ?'
    ).run(template_id, JSON.stringify(page_config || {}), req.userId);

    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

module.exports = router;
