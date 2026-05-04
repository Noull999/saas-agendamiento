require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.resolve(process.env.DB_PATH || './data/saas.db'));

// Elimina negocio de prueba si existe
db.prepare('DELETE FROM businesses WHERE slug = ?').run('workly-prueba');

const business = db.prepare('SELECT * FROM businesses LIMIT 1').get();
if (!business) {
  console.error('No hay negocio registrado. Regístrate primero en el dashboard.');
  process.exit(1);
}
console.log(`Negocio: ${business.name} (id=${business.id})`);

// Servicios
db.prepare('DELETE FROM services WHERE business_id = ?').run(business.id);
const ins = db.prepare('INSERT INTO services (business_id, name, description, duration_min) VALUES (?, ?, ?, ?)');
ins.run(business.id, 'Análisis de datos', 'Procesamiento y limpieza de bases de datos, visualización con gráficos e informes, dashboards interactivos, análisis estadístico y automatización de reportes.', 60);
ins.run(business.id, 'Soporte técnico (hardware y software)', 'Diagnóstico y reparación de PCs, laptops y periféricos. Instalación de software, eliminación de virus, optimización del sistema y mantenimiento preventivo.', 60);
ins.run(business.id, 'Apps locales (escritorio)', 'Desarrollo de software a medida: control de inventario, facturación, CRM, automatización de procesos y necesidades específicas de tu negocio.', 90);
ins.run(business.id, 'Apps web', 'Sitios web, tiendas online, sistemas de reservas, plataformas de gestión y aplicaciones web personalizadas.', 90);
console.log('4 servicios insertados');

// Horarios
db.prepare('DELETE FROM schedules WHERE business_id = ?').run(business.id);
const insh = db.prepare('INSERT INTO schedules (business_id, dow, slots) VALUES (?, ?, ?)');
insh.run(business.id, 0, JSON.stringify(['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00']));
insh.run(business.id, 1, JSON.stringify(['23:00']));
insh.run(business.id, 2, JSON.stringify(['19:00','20:00','21:00']));
insh.run(business.id, 3, JSON.stringify(['23:00']));
insh.run(business.id, 4, JSON.stringify(['19:00','20:00','21:00']));
insh.run(business.id, 5, JSON.stringify(['23:00']));
insh.run(business.id, 6, JSON.stringify(['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00']));
console.log('7 dias de horarios insertados');
console.log('Recarga el dashboard!');
