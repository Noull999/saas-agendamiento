import {
  HeartPulse, Scissors, Building2, Calendar, Wrench, Clock, User, Stethoscope,
  Users, BarChart3, Settings,
} from 'lucide-react';

export const VERTICALS = {
  salud: {
    id: 'salud',
    label: 'Salud',
    icon: HeartPulse,
    description: 'Médicos, kinesiólogos, psicólogos, nutricionistas y más',
    color: 'indigo',
    specialties: [
      { value: 'medicina', label: 'Medicina General' },
      { value: 'kinesiologia', label: 'Kinesiología' },
      { value: 'psicologia', label: 'Psicología' },
      { value: 'nutricion', label: 'Nutrición' },
      { value: 'odontologia', label: 'Odontología' },
    ],
    modules: [
      { to: '/dashboard', label: 'Reservas', icon: Calendar },
      { to: '/dashboard/servicios', label: 'Servicios', icon: Wrench },
      { to: '/dashboard/horarios', label: 'Horarios', icon: Clock },
      { to: '/dashboard/pacientes', label: 'Pacientes', icon: User, minPlan: 'pro' },
      { to: '/dashboard/consultas', label: 'Consultas', icon: Stethoscope, minPlan: 'pro' },
      { to: '/dashboard/profesionales', label: 'Profesionales', icon: Users, minPlan: 'pro' },
      { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, minPlan: 'pro' },
      { to: '/dashboard/sucursales', label: 'Sucursales', icon: Building2, minPlan: 'business' },
      { to: '/dashboard/configuracion', label: 'Configuración', icon: Settings },
    ],
    booking: { showRut: true, clientLabel: 'Paciente' },
  },
  belleza: {
    id: 'belleza',
    label: 'Belleza & Peluquería',
    icon: Scissors,
    description: 'Peluquerías, barberías, salones de belleza, spa y nail art',
    color: 'pink',
    specialties: [
      { value: 'peluqueria', label: 'Peluquería' },
      { value: 'barberia', label: 'Barbería' },
      { value: 'salon_belleza', label: 'Salón de Belleza' },
      { value: 'nail_art', label: 'Nail Art' },
      { value: 'spa', label: 'Spa & Masajes' },
      { value: 'maquillaje', label: 'Maquillaje' },
    ],
    modules: [
      { to: '/dashboard', label: 'Reservas', icon: Calendar },
      { to: '/dashboard/servicios', label: 'Servicios', icon: Scissors },
      { to: '/dashboard/horarios', label: 'Horarios', icon: Clock },
      { to: '/dashboard/clientes', label: 'Clientes', icon: User, minPlan: 'pro' },
      { to: '/dashboard/profesionales', label: 'Estilistas', icon: Users, minPlan: 'pro' },
      { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, minPlan: 'pro' },
      { to: '/dashboard/sucursales', label: 'Sucursales', icon: Building2, minPlan: 'business' },
      { to: '/dashboard/configuracion', label: 'Configuración', icon: Settings },
    ],
    booking: { showRut: false, clientLabel: 'Cliente' },
  },
  general: {
    id: 'general',
    label: 'Otro negocio',
    icon: Building2,
    description: 'Consultorías, talleres, clases, arriendo de espacios y más',
    color: 'slate',
    specialties: [
      { value: 'consultoria', label: 'Consultoría' },
      { value: 'clases', label: 'Clases & Tutorías' },
      { value: 'taller', label: 'Taller & Capacitación' },
      { value: 'arriendo', label: 'Arriendo de espacios' },
      { value: 'veterinaria', label: 'Veterinaria' },
      { value: 'otro', label: 'Otro' },
    ],
    modules: [
      { to: '/dashboard', label: 'Reservas', icon: Calendar },
      { to: '/dashboard/servicios', label: 'Servicios', icon: Wrench },
      { to: '/dashboard/horarios', label: 'Horarios', icon: Clock },
      { to: '/dashboard/clientes', label: 'Clientes', icon: User, minPlan: 'pro' },
      { to: '/dashboard/profesionales', label: 'Profesionales', icon: Users, minPlan: 'pro' },
      { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, minPlan: 'pro' },
      { to: '/dashboard/sucursales', label: 'Sucursales', icon: Building2, minPlan: 'business' },
      { to: '/dashboard/configuracion', label: 'Configuración', icon: Settings },
    ],
    booking: { showRut: false, clientLabel: 'Cliente' },
  },
};

const PLAN_ORDER = ['basic', 'pro', 'business'];

export function meetsMinPlan(currentPlan, minPlan) {
  if (!minPlan) return true;
  return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(minPlan);
}

export function getVertical(verticalId) {
  return VERTICALS[verticalId] || VERTICALS.salud;
}
