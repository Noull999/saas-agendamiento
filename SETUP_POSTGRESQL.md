# Setup PostgreSQL para Producción

## Verificación de lo realizado

✅ **Completado:**
- Generadas claves criptográficas seguras (ENCRYPTION_KEY, JWT_SECRET)
- Creado archivo `.env` con configuración de desarrollo
- Actualizado `.env.example` con estructura correcta
- Script de migración automática creado (`scripts/migrate.js`)
- Código actualizado para soportar `DATABASE_URL` y variables individuales

## Instalación de PostgreSQL

### Windows

1. **Descargar PostgreSQL 14+ desde:** https://www.postgresql.org/download/windows/
2. **Durante instalación:**
   - Anotar contraseña del usuario `postgres`
   - Confirmar puerto 5432
   - Instalar pgAdmin (opcional pero útil)

3. **Verificar instalación:**
   ```bash
   psql --version
   ```

### macOS

```bash
# Con Homebrew
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## Configuración de Variables de Entorno

### Opción 1: DATABASE_URL (Recomendado para Heroku/Vercel)

```bash
DATABASE_URL=postgresql://user:password@host:5432/database_name
```

**Ejemplo desarrollo local:**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saas_dev
```

**Ejemplo producción (Heroku):**
```
DATABASE_URL=postgresql://user123:abc456xyz@ec2-1-2-3-4.compute-1.amazonaws.com:5432/dbname
```

### Opción 2: Variables Individuales

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=saas_dev
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false  # true en producción con SSL
```

## Crear Base de Datos Localmente

### Con psql (línea de comandos)

```bash
# Conectar como super user
psql -U postgres

# En la terminal psql:
CREATE DATABASE saas_dev ENCODING 'UTF8';
```

### Con PgAdmin (interfaz gráfica)

1. Abrir PgAdmin
2. Right-click en "Databases"
3. Crear → Database
4. Nombre: `saas_dev`
5. Encoding: UTF8

## Ejecutar Migraciones

**Una vez PostgreSQL esté corriendo:**

```bash
cd backend
npm run migrate
```

El script va a:
1. Conectar a PostgreSQL
2. Crear la base de datos si no existe
3. Ejecutar schema SQL
4. Agregar columnas faltantes
5. Verificar Row Level Security

**Salida esperada:**
```
[MIGRATION] Conectando a PostgreSQL...
[MIGRATION] Conexión exitosa a PostgreSQL
[MIGRATION] Creando base de datos saas_dev...
[MIGRATION] Base de datos saas_dev creada
[MIGRATION] Ejecutando schema SQL...
[MIGRATION] ✓ Schema creado exitosamente
[MIGRATION] ✓ Todas las migraciones completadas
```

## Verificar que Todo Funciona

```bash
# Levantar el backend
npm run dev

# Debe mostrar:
# [DB] PostgreSQL connected successfully
# [API] Servidor corriendo en http://localhost:3001
```

## Datos de Conexión Actual (DESARROLLO)

```
HOST:        localhost
PORT:        5432
DATABASE:    saas_dev
USER:        postgres
PASSWORD:    postgres
ENCRYPTION_KEY: 38ffbd729512bcbd10e744e3860816f25abfdf148fdece15672e44c877834ef6
JWT_SECRET:     3d809dc45720e6f93a0a7cee2c6ede4b36421bc4f2a1f94e3c548750fcdc9139
```

## Troubleshooting

### Error: "connection refused"
```
❌ PostgreSQL no está corriendo
✅ Solución: Ejecutar `pg_ctl start` o verificar servicio
```

### Error: "password authentication failed"
```
❌ Credenciales incorrectas
✅ Solución: Revisar DB_USER y DB_PASSWORD en .env
```

### Error: "database does not exist"
```
❌ Base de datos no creada
✅ Solución: Ejecutar `npm run migrate`
```

### Error: "permission denied"
```
❌ Usuario PostgreSQL sin permisos
✅ Solución: En psql: ALTER USER postgres WITH SUPERUSER;
```

## Pasos Siguientes para Producción

1. **Cambiar credenciales:**
   ```bash
   # Generar nuevas claves (NO usar las de desarrollo)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Configurar servicios externos:**
   - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS
   - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
   - SENTRY_DSN (opcional)

3. **Conectar a PostgreSQL remoto:**
   - Opciones: AWS RDS, Heroku Postgres, Supabase, Railway, etc.
   - Usar DATABASE_URL proporcionada por el proveedor

4. **HTTPS y proxy inverso:**
   - Nginx/Caddy apuntando a puerto 3001
   - Certificados SSL (Let's Encrypt)
   - Headers de seguridad (ya configurados en código)

5. **Variables de entorno en hosting:**
   - Vercel: Settings → Environment Variables
   - Heroku: Settings → Config Vars
   - Railway: Variables tab
   - Docker: ENV en Dockerfile

---

**Estado:** ✅ Backend listo para producción
**Siguiente:** Configurar APIs externas (Stripe, Twilio, Sentry)
