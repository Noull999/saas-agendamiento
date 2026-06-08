# 📧 Configurar envío de emails (SMTP)

La app ya tiene **todo el código de emails listo**. Solo falta darle credenciales de un
servidor SMTP mediante variables de entorno. Sin esto, estos dos flujos **no envían nada**
(no fallan, simplemente se omiten en silencio):

| Flujo | Archivo |
|---|---|
| Confirmación de reserva (con link de cancelación) | `backend/src/services/email.js` |
| Recuperación de contraseña ("¿Olvidaste tu clave?") | `backend/src/controllers/auth.controller.js` |

---

## Variables que necesitas

Estas son las variables exactas que lee el código:

```env
SMTP_HOST=...        # servidor SMTP
SMTP_PORT=587        # 587 (TLS) o 465 (SSL)
SMTP_USER=...        # usuario / API key
SMTP_PASS=...        # contraseña / API key secreta
SMTP_FROM=...        # remitente visible (opcional; si falta usa SMTP_USER)
FRONTEND_URL=https://tu-app.vercel.app   # para que los links de los emails apunten bien
```

> `FRONTEND_URL` ya debería estar configurada para CORS. Es la misma variable y es importante:
> sin ella, los links de "cancelar reserva" y "restablecer contraseña" apuntarán a `localhost`.

---

## Opción A — Resend (recomendado, gratis) ✅

Resend regala **3.000 emails/mes** y es la opción más simple para producción.

1. Crea una cuenta en **https://resend.com** (gratis, sin tarjeta).
2. Verifica tu dominio en **Domains → Add Domain** (agregas unos registros DNS).
   - ¿No tienes dominio aún? Puedes empezar usando el dominio de pruebas que Resend te da,
     pero para clientes reales conviene verificar el tuyo (mejor entregabilidad).
3. Ve a **API Keys → Create API Key** y copia la clave (empieza con `re_...`).
4. Usa estos valores:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_tu_api_key_aqui
SMTP_FROM="Tu Negocio <reservas@tu-dominio.com>"
```

> Con Resend el `SMTP_USER` es literalmente la palabra `resend`, y la API key va en `SMTP_PASS`.
> El correo de `SMTP_FROM` debe pertenecer a un dominio verificado en Resend.

---

## Opción B — Gmail (rápido para probar)

Sirve para pruebas o volúmenes bajos. **No uses tu contraseña normal**: Gmail exige una
"contraseña de aplicación".

1. Activa la **verificación en 2 pasos** en tu cuenta Google:
   https://myaccount.google.com/security
2. Crea una **contraseña de aplicación**:
   https://myaccount.google.com/apppasswords
   (elige "Correo" / "Otro" y copia los 16 caracteres que genera).
3. Usa estos valores:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucuenta@gmail.com
SMTP_PASS=los16caracteres_sin_espacios
SMTP_FROM="Tu Negocio <tucuenta@gmail.com>"
```

> Limitación: Gmail corta el envío alrededor de ~500 correos/día y puede marcar como spam si
> el volumen sube. Para producción real, usa la Opción A.

---

## Dónde poner estas variables

### En desarrollo (local)
Agrégalas a `backend/.env` y reinicia el backend.

### En producción (Railway)
1. Entra a tu proyecto en **Railway**.
2. Servicio del backend → pestaña **Variables**.
3. Agrega cada variable (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
4. Railway redeploya solo al guardar.

---

## Cómo probar que funciona

1. Con las variables ya cargadas, ve a la pantalla de login → **"¿Olvidaste tu contraseña?"**.
2. Ingresa el email de una cuenta existente.
3. Deberías recibir el correo con el link de restablecimiento en 1–2 minutos.
4. Para probar la confirmación de reserva: crea una reserva desde la página pública
   (`/book/tu-slug`) ingresando un email; debería llegar la confirmación.

Si **no llega**:
- Revisa los logs del backend en Railway (busca `[auth] Error enviando email` o errores SMTP).
- Verifica que `SMTP_USER` / `SMTP_PASS` sean correctos.
- En Gmail, confirma que usaste la **contraseña de aplicación**, no la normal.
- En Resend, confirma que el dominio del `SMTP_FROM` está **verificado**.
- Revisa la carpeta de **spam**.

---

## Nota de seguridad

- **Nunca** subas el archivo `.env` ni las claves al repositorio (ya está en `.gitignore`).
- Si una API key se filtra, revócala y genera una nueva (en Resend: API Keys → revoke).
