# DEMO VIDEO SCRIPT (2 Minutos)

## Preparación
```bash
# Terminal 1
cd backend && npm run seed:demo && npm run dev

# Terminal 2  
cd frontend && npm run dev
```

Credenciales: 
- Email: `dr.garcia@smileware.com`
- Pass: `demo123`

---

## 🎬 SCRIPT (narración en español)

### [00:00-00:15] INTRO

**Narración:**
> "Hola, soy [tu nombre]. Te muestro el SaaS #1 para agendamiento médico en LATAM. 
> En 2 minutos verás por qué 500+ clínicas lo usan.
> Comenzamos."

**Visual:**
- Pantalla en negro
- Logo/título fade in: "SaaS Agendamiento"
- Fade to login page

---

### [00:15-00:40] DASHBOARD & CITAS

**Narración:**
> "Aquí estoy como Dr. García. Mi calendario muestra citas de hoy y los próximos días.
> Tengo:
> - Una cita confirmada a las 9am (Juan Pérez - Limpieza)
> - Una pendiente a las 10:30am (María González - Obturación)  
> - Una completada ayer (Carlos López)
> 
> Con un click confirmo la cita pendiente..."

**Acciones en pantalla:**
1. [00:15] Login page → ingresar credenciales
2. [00:20] Click "Ingresar" → carga dashboard
3. [00:25] Mostrar 3 citas en calendar/list
4. [00:30] Click cita "pendiente" → muestra detalles
5. [00:35] Click "Confirmar" → transición/confirmación visual
6. [00:40] Texto aparece: "WhatsApp enviado a María"

**Visual:**
- Pantalla de dashboard con citas
- Zoom en cita pendiente
- Botón "Confirmar" destacado
- Animación de "✓ Confirmada"

---

### [00:40-01:00] CONFIGURACIÓN

**Narración:**
> "Ahora veamos la configuración. Tengo 3 servicios:
> - Limpieza: $85.000 (45 min)
> - Obturación: $120.000 (1 hora)
> - Implante: $850.000 (2 horas)
> 
> Mis horarios son Lunes-Viernes 8am a 5pm.
> Todo auto-configurable, una sola vez."

**Acciones en pantalla:**
1. [00:40] Click `/dashboard/servicios`
2. [00:45] Mostrar lista de servicios con precios
3. [00:50] Click `/dashboard/horarios`  
4. [00:55] Mostrar grid de días/horarios
5. [01:00] Texto: "Automático para página pública"

**Visual:**
- Tab de servicios abierto
- Precios y duraciones visibles
- Grid de horarios con colores
- Animación smooth entre tabs

---

### [01:00-01:25] PÁGINA PÚBLICA (PACIENTE)

**Narración:**
> "Aquí está la página de reserva que ven tus pacientes.
> La puedes compartir por WhatsApp, Facebook, Google Maps.
> 
> El paciente:
> 1. Elige servicio
> 2. Elige fecha y hora
> 3. Ingresa RUT (validado automáticamente)
> 4. ¡Listo! Reserva confirmada"

**Acciones en pantalla:**
1. [01:00] Abrir nueva pestaña (o split screen)
2. [01:05] URL: `http://localhost:5173/book/smileware-dental`
3. [01:10] Mostrar página pública (sin login)
4. [01:15] Simular flujo: click servicio → click fecha → click hora
5. [01:20] Llenar RUT: "17234567-8"
6. [01:25] Click "Confirmar reserva"

**Visual:**
- URL clara en la barra
- Página limpia, responsive
- Selector visual de servicios
- Calendario interactivo
- RUT input con validación ✓

---

### [01:25-01:45] DATOS MÉDICOS (PLAN CLÍNICA)

**Narración:**
> "Plan Clínica incluye historial médico completo.
> Aquí veo pacientes con su historia clínica.
> Cada consulta: notas cifradas, prescripciones.
> Todo encriptado (HIPAA-compliant).
> Nada en la nube de terceros. Datos tuyos."

**Acciones en pantalla:**
1. [01:25] Click `/dashboard/pacientes`
2. [01:30] Mostrar lista de pacientes
3. [01:35] Click en paciente → ver perfil
4. [01:40] Mostrar consultas + prescripciones
5. [01:45] Texto: "Encriptación AES-256"

**Visual:**
- Lista de pacientes con avatares
- Perfil de paciente (RUT, teléfono, etc)
- Timeline de consultas
- Prescripciones listadas
- Icono de candado (seguridad)

---

### [01:45-02:00] CIERRE

**Narración:**
> "Eso es lo esencial:
> ✓ Gestión de citas sin doble-reservas
> ✓ Confirmación automática por WhatsApp
> ✓ Historial médico cifrado (Plan Clínica)
> ✓ Transparent pricing: Plan PRO $19.990, Clínica $49.990
> ✓ Prueba gratis 14 días. Sin tarjeta de crédito.
> 
> Cancela cuando quieras. Datos tuyos siempre.
> ¿Interesado? Abre SaaS-agendamiento.com o escribe a sales@..."

**Acciones en pantalla:**
1. [01:45] Volver a dashboard principal
2. [01:50] Montaje rápido de pantallazos: servicios → horarios → pacientes
3. [01:55] Mostrar "Plan PRO - $19.990/mes"
4. [02:00] Pantalla final: Logo + contacto

**Visual:**
- Montaje dinámico (rápido, no aburrido)
- Texto de cierre: 
  ```
  SaaS de Agendamiento
  Para Médicos en LATAM
  
  Prueba Gratis 14 Días
  sales@agendamiento-saas.com
  www.agendamiento-saas.com
  ```
- Fade out

---

## 📹 NOTAS DE GRABACIÓN

### Técnico
- **Resolución**: 1920x1080 o 1080x720 (vertical)
- **FPS**: 30fps mínimo
- **Micrófono**: Bluetooth/headset (no PC integrado)
- **Música**: Background suave (royalty-free)

### Timing
- No hablar muy rápido (100 ppm máx)
- Pausas entre acciones (dejar que el usuario lea)
- No clickear instantáneo (simular realismo)

### Pantalla
- Zoom a 125% (texto legible en móvil)
- Colores claros (evitar fondos oscuros)
- Cursor grande y visible

### Errores a Evitar
- ❌ "Umm..." o "eh..." (editar)
- ❌ Titubeos (grabar varias tomas)
- ❌ Ir muy rápido (confunde)
- ❌ Mostrar bugs (resetear y regrab ar)

---

## 🎬 EDICIÓN (POST-PRODUCTION)

**Software recomendado:**
- OBS Studio (grabar)
- CapCut o DaVinci Resolve (editar)
- Ffmpeg (optimizar)

**Editar:**
1. Cortar silencios al inicio/fin
2. Reducir velocidad playback en partes técnicas
3. Agregar subtítulos en español
4. Agregar cursor destacado (screen cursor app)
5. Fade in/out con música
6. Lower third: "Dr. García - SmileCare Dental"

**Subtítulos:**
```
[00:15-00:40] Dashboard & Citas
[00:40-01:00] Configuración
[01:00-01:25] Página Pública
[01:25-01:45] Historial Médico
[01:45-02:00] Cierre
```

---

## 📊 DISTRIBUCIÓN

**Plataformas:**
- ✅ YouTube: Playlist "Demo"
- ✅ LinkedIn: Video + descripción
- ✅ Instagram Reels: Versión 30-45 seg
- ✅ TikTok: Versión 15 seg
- ✅ Web: Embebido en landing page

**Descripciones:**
```
SaaS de Agendamiento para Salud en LATAM

En 2 minutos ve cómo:
✓ Gestionar citas sin doble-reservas
✓ Confirmación automática por WhatsApp  
✓ Historial médico encriptado (HIPAA)
✓ Analytics de ingresos
✓ Pacientes satisfechos

📱 Prueba gratis 14 días:
www.agendamiento-saas.com

#SaaS #Telemedicina #LATAM #Agendamiento
```

---

## ✅ CHECKLIST PRE-GRABACIÓN

- [ ] Base de datos demo ejecutada
- [ ] Navegador limpio (borrar historial)
- [ ] Extensiones desactivadas
- [ ] Pantalla 1920x1080 (16:9)
- [ ] WiFi estable (no grabar en WiFi débil)
- [ ] Micrófono probado (sin ruido)
- [ ] OBS configurado
- [ ] Múltiples tomas (5-10 intentos)
- [ ] Backup de video (2 copias)
- [ ] Licencias de música verificadas

---

Listo para grabar. 🎬 ¡Éxito!
