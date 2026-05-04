# SaaS de Agendamiento

## Arrancar en desarrollo

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Corre en http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Corre en http://localhost:5173
```

## Rutas principales

| URL | Descripción |
|-----|-------------|
| `http://localhost:5173/register` | Registro de negocio |
| `http://localhost:5173/login` | Login |
| `http://localhost:5173/dashboard` | Panel de reservas |
| `http://localhost:5173/dashboard/servicios` | Gestión de servicios |
| `http://localhost:5173/dashboard/horarios` | Configurar horarios |
| `http://localhost:5173/book/:slug` | Página pública del cliente |

## API Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Registrar negocio |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | JWT | Perfil del negocio |
| GET | `/api/services` | JWT | Listar servicios |
| POST | `/api/services` | JWT | Crear servicio |
| PUT | `/api/services/:id` | JWT | Editar servicio |
| DELETE | `/api/services/:id` | JWT | Eliminar servicio |
| GET | `/api/schedules` | JWT | Listar horarios |
| POST | `/api/schedules` | JWT | Guardar horario (upsert) |
| GET | `/api/bookings` | JWT | Listar reservas (filtros: date, status) |
| PATCH | `/api/bookings/:id/status` | JWT | Cambiar estado reserva |
| POST | `/api/bookings/public/:slug` | No | Crear reserva (público) |
| GET | `/api/public/:slug` | No | Perfil público del negocio |
