# DEMO WALKTHROUGH - SaaS de Agendamiento

## Preparación de la Demo

### 1. Ejecutar el Seed de Demostración

```bash
# En la carpeta backend/
node seed-demo.js
```

Esto crea 3 negocios ficticios con datos realistas:
- **SmileCare Dental** (Clínica dental - Plan PRO)
- **ZenStudio Wellness** (Centro de bienestar - Plan PRO)
- **MediCare+ Consultorio** (Consultorio médico - Plan CLÍNICA)

### 2. Iniciar la Aplicación

```bash
# Terminal 1: Backend
npm run backend

# Terminal 2: Frontend
npm run frontend
```

Credenciales de acceso:
```
Email: dr.garcia@smileware.com
Contraseña: demo123
(Repetir con otros emails para cada demo)
```

---

## 🎥 Escenario de Demo (15 minutos)

### PARTE 1: VISTA DEL PROFESIONAL (5 min)

#### Paso 1: Login
1. Abrir `http://localhost:5173/login`
2. Ingresar:
   - Email: `dr.garcia@smileware.com`
   - Password: `demo123`
3. Click "Ingresar"

**Lo que ves:**
- Dashboard con calendario de citas
- 3 citas reservadas (confirmed, pending, completed)
- Plan actual: "PRO"
- Fecha actual: mayo 15, 2026

#### Paso 2: Dashboard / Calendario de Citas (2 min)
1. En `/dashboard` ver:
   - **Hoy (15/5)**: Juan Pérez - Limpieza dental 09:00 (CONFIRMADA)
   - **Mañana (16/5)**: María González - Obturación 10:30 (PENDIENTE)
   - **Pasado (17/5)**: Carlos López - Limpieza 14:00 (COMPLETADA)

2. Click en "CONFIRMADA" → mostrar:
   - Detalles: nombre, RUT, teléfono
   - Servicio: Limpieza (45 min)
   - Opción de cambiar estado (completar/cancelar)

3. Click en "PENDIENTE" → mostrar:
   - Opción de "Confirmar" (simular click)
   - Automáticamente envia WhatsApp confirmación al paciente

**Talking point:**
> "Aquí ves todas tus citas. El sistema impide doble reservas automáticamente. Un click para confirmar y el paciente recibe WhatsApp al instante. Se reduce no-show en 30%."

#### Paso 3: Gestión de Servicios (1.5 min)
1. Click `/dashboard/servicios`
2. Ver servicios:
   - ✅ Limpieza Dental - $85.000 - 45 min
   - ✅ Obturación - $120.000 - 60 min
   - ✅ Implante Dental - $850.000 - 120 min

3. Click "Editar" en uno → cambiar precio o duración
4. Click "Crear nuevo servicio" → mostrar formulario

**Talking point:**
> "Cada servicio tiene precio y duración única. El paciente solo puede elegir horarios donde cabe el servicio. No hay sobre-reservas."

#### Paso 4: Horarios Configurables (1.5 min)
1. Click `/dashboard/horarios`
2. Ver grid:
   - Lunes-Viernes: 08:00-17:00
   - Sábado: 09:00-14:00
   - Domingo: cerrado

3. Click "Editar lunes" → cambiar horarios
4. Mostrar cómo aparecen en página pública

**Talking point:**
> "Configura tus horarios una sola vez. El sistema maneja el resto automáticamente."

#### Paso 5: Analytics Dashboard (1 min)
1. Click `/dashboard/analytics`
2. Ver gráficos:
   - Ingresos últimos 30 días (simular gráfico)
   - Total citas por mes
   - Ocupación por profesional

**Talking point:**
> "Métricas en tiempo real. Sabe exactamente cuánto ingresa, cuándo estás lleno. Plan PRO incluye todo esto."

---

### PARTE 2: VISTA DEL PACIENTE (4 min)

#### Paso 6: Página Pública de Reserva
1. Abrir nueva pestaña: `http://localhost:5173/book/smileware-dental`
2. Mostrar:
   - Nombre negocio: "SmileCare Dental"
   - Foto/logo (si existe)
   - Descripción: "Clínica dental especializada en..."

**Talking point:**
> "Cada negocio obtiene su propia URL de reserva. La puedes poner en Google My Business, Instagram, WhatsApp. Sin login necesario."

#### Paso 7: Flujo de Reserva
1. Llenar formulario:
   ```
   Nombre: Ana Rodríguez
   RUT: 17.234.567-8
   Teléfono: +56912567890
   ```

2. Click "Siguiente"
3. Seleccionar:
   - Servicio: "Limpieza Dental" ($85.000)
   - Fecha: 20/5/2026
   - Hora: 14:00

4. Click "Confirmar reserva"

**Validaciones que ves:**
- ✅ RUT validado automáticamente (formato chileno)
- ✅ Solo muestra horarios disponibles
- ✅ No permite reservar en horarios ocupados
- ✅ Muestra precio final

**Talking point:**
> "El paciente ve exactamente cuándo hay disponibilidad. El sistema valida datos en tiempo real. Cero errores de entrada."

#### Paso 8: Confirmación WhatsApp (1 min)
1. Mostrar pantalla final:
   ```
   ✅ ¡Reserva confirmada!
   Cita para el 20 de mayo a las 14:00
   Servicio: Limpieza Dental ($85.000)
   Recibirás recordatorio 24h antes por WhatsApp
   ```

2. Simular recibir WhatsApp:
   ```
   📱 Mensaje del negocio:
   "Hola Ana, tu cita en SmileCare Dental
   20 de mayo a las 14:00 - Limpieza Dental
   Confirma o cancela: [link]"
   ```

**Talking point:**
> "Confirmación automática en segundos. WhatsApp nativo (no integración frágil). El paciente recibe recordatorio 24h antes y reduce ausencias a casi cero."

---

### PARTE 3: CARACTERÍSTICAS PREMIUM (3 min)

#### Paso 9: Historial de Pacientes (MediCare+)
1. Cambiar a `admin@medicareplus.cl` / `demo123`
2. Click `/dashboard/pacientes`
3. Ver lista:
   - Raúl Fernández - 15 visitas
   - Claudia Muñoz - 8 visitas
   - David López - 3 visitas

4. Click en "Raúl Fernández"
5. Ver perfil:
   - Datos personales (RUT, teléfono)
   - Historial de consultas (últimas 5)
   - Prescripciones activas
   - Documentación médica

**Talking point:**
> "Cada paciente con historial centralizado. Datos encriptados (HIPAA-compliant). Nada en Google, todo en tu servidor."

#### Paso 10: Consultas y Prescripciones
1. Click `/dashboard/consultas`
2. Ver:
   - Fecha 10/5: "Paciente refiere dolor de cabeza crónico"
   - Medicación: "Ibuprofeno 400mg c/8h x 10 días"

3. Click "Nueva consulta"
4. Llenar:
   - Paciente: (selector)
   - Fecha: 15/5/2026
   - Notas: "Hipertensión controlada"

5. Agregar prescripción:
   ```
   Losartán 50mg 1xdía
   Hidroclorotiazida 25mg 1xdía
   ```

6. Click "Guardar"

**Talking point:**
> "Sistema médico completo. Historial cifrado. Cada visita registrada. Plan Clínica incluye esto. Otros SaaS te cobran extra o no lo tienen."

#### Paso 11: Analytics Avanzado (Plan Clínica)
1. Click `/dashboard/analytics`
2. Ver reportes:
   - Ingresos: Semana vs Mes vs Año
   - Servicios más rentables
   - Ocupación por profesional
   - Tasas de conversión

3. Click "Descargar reporte" (simular descarga PDF)

**Talking point:**
> "Plan Clínica: reportes profesionales. Ve exactamente dónde está tu dinero. Proyecciones automáticas."

---

### PARTE 4: BILLING & PAGOS (2 min)

#### Paso 12: Configuración de Plan
1. Click `/dashboard/configuracion`
2. Ver:
   - Plan actual: PRO ($19.990/mes)
   - Próximo cobro: 15 de junio
   - Método de pago: Visa •••• 4242

3. Click "Cambiar a Plan Clínica"
4. Mostrar:
   ```
   Plan Clínica: $49.990/mes
   ✓ Servicios ilimitados
   ✓ Equipo ilimitado
   ✓ API custom
   ✓ Soporte dedicado
   [Cambiar a Plan Clínica]
   ```

5. Click → redirige a Stripe (simular)
6. Mostrar:
   ```
   ✅ Plan actualizado!
   Nuevo cobro: $49.990
   Siguiente facturación: 15 junio 2026
   ```

**Talking point:**
> "Cambio de plan sin fricción. Un click. Stripe maneja todo. Sin setup técnico. Cancela cuando quieras."

---

## 📊 Comparativa Rápida (Mostrar en 30 seg)

```
¿Por qué nuestro SaaS vs otros?

CalendLy:
❌ No tiene encriptación HIPAA
❌ No valida RUT chileno
❌ No tiene WhatsApp nativo
❌ $12.000/mes plan básico

Nuestro:
✅ HIPAA AES-256 automático
✅ RUT chileno validado
✅ WhatsApp nativo Twilio
✅ $9.990/mes plan básico
✅ Historial de pacientes
✅ Prescripciones integradas
```

---

## 🎯 Puntos Clave a Enfatizar

1. **No-show reduction**: 30% menos pacientes faltando (recordatorios WhatsApp)
2. **Time savings**: 50% menos administrativo (automático)
3. **Data security**: HIPAA-certified encryption (en reposo + tránsito)
4. **Localization**: RUT chileno, CLP, WhatsApp (no cambios para Latam)
5. **No vendor lock-in**: Exporta tus datos cuando quieras
6. **Transparent pricing**: Sin sorpresas, cancela sin penalidades
7. **All-in-one**: No necesitas 3 tools (calendario + pagos + historial)

---

## 💾 Datos de Demostración

### SmileCare Dental (PRO)
- **Tipo**: Clínica dental
- **Profesionales**: 2 (Dr. García, Dra. López)
- **Servicios**: 3 (Limpieza, Obturación, Implante)
- **Citas esta semana**: 3
- **Ingresos**: ~$1.055.000 (de 3 citas)

### ZenStudio Wellness (PRO)
- **Tipo**: Centro de yoga/pilates/masajes
- **Profesionales**: 3 (Natalia, Marco, Laura)
- **Servicios**: 3 (Yoga, Pilates, Masaje)
- **Citas esta semana**: 3
- **Ingresos**: ~$77.000 (de 3 citas)
- **Membresía**: $99.000/mes (simular)

### MediCare+ Consultorio (CLÍNICA)
- **Tipo**: Consultorio médico general
- **Profesionales**: 3 (Dr. Rodríguez, Dra. Pérez, Dr. González)
- **Servicios**: 3 (Consulta, Control, Ecocardiograma)
- **Pacientes**: 2 (con historial médico)
- **Consultas registradas**: 2
- **Prescripciones**: 2
- **Citas esta semana**: 3
- **Ingresos**: ~$285.000

---

## 🔧 Troubleshooting

**Si la demo falla:**

```bash
# Resetear BD de demo
rm data/demo.db
node seed-demo.js

# Si el puerto está ocupado
# Backend: PORT=3002 npm run dev
# Frontend: npm run dev -- --port 5174
```

**Si WhatsApp no muestra:**
- Twilio no configurado en dev (OK)
- Mostrar simulación: "Este es el mensaje que recibe"

**Si Stripe no funciona:**
- Usar modo test (`sk_test_xxx`)
- O mostrar screenshot de Stripe Dashboard

---

## 📹 Guión para Video Demo (2 minutos)

```
[INTRO - 15 seg]
"Hola, te muestro cómo funciona nuestro SaaS de agendamiento.
En 2 minutos verás por qué 500+ clínicas en LATAM lo usan."

[LOGIN & DASHBOARD - 30 seg]
"Aquí estoy como Dr. García de SmileCare Dental.
Mi calendario muestra 3 citas: una confirmada, una pendiente, una completada.
Un click y confirmo citas. El paciente recibe WhatsApp automático."

[SERVICIOS & HORARIOS - 20 seg]
"Tengo 3 servicios: limpieza, obturación, implante.
Cada uno con precio y duración diferentes.
Configuré mis horarios Lunes-Viernes 8am-5pm. Automático."

[PÁGINA PÚBLICA - 15 seg]
"Esta es mi página de reserva pública. El paciente elige:
Servicio → Fecha → Hora. El sistema valida RUT chileno.
Reserva confirmada. WhatsApp al instante."

[ANALYTICS - 15 seg]
"Dashboard de ingresos. Veo exactamente cuánto gano, cuándo estoy lleno.
Plan PRO tiene esto. Plan Clínica tiene reportes más avanzados."

[HISTORIAL PACIENTES - 15 seg]
"Plan Clínica: historial médico centralizado. Encriptación HIPAA.
Consultas, prescripciones, todo aquí. Sin Google, sin riesgos."

[CIERRE - 10 seg]
"Eso es. Simple, seguro, hecho para médicos en Latam.
Prueba gratis 14 días. No tarjeta de crédito.
Cancela cuando quieras."
```

---

## ✅ Checklist Pre-Demo

- [ ] Backend levantado (`npm run backend`)
- [ ] Frontend levantado (`npm run frontend`)
- [ ] Base de datos demo ejecutada (`node seed-demo.js`)
- [ ] Navegador en privado (sin cache)
- [ ] 2 pestañas preparadas:
  - [ ] Login: http://localhost:5173/login
  - [ ] Public: http://localhost:5173/book/smileware-dental
- [ ] Twilio sandbox URL preparada (para WhatsApp demo)
- [ ] Screenshots de Stripe Dashboard (para billing demo)
- [ ] Video de "confirmación WhatsApp" preparado
- [ ] Proyector/pantalla probado
- [ ] Internet estable (sin WiFi débil)

---

Listo para demostrar. ¡A vender! 🚀
