// Precios finales (IGV incluido)
export const PRECIO_SESION_ENTRADA = 180;
export const PRECIO_PAQUETE_4 = 650;
export const IGV_RATE = 0.18;

// Calcular base imponible e IGV desde precio final (precio incluye IGV)
export function calcularIGV(precioFinal) {
  const base = precioFinal / (1 + IGV_RATE);
  const igv = precioFinal - base;
  return {
    base: Math.round(base * 100) / 100,
    igv: Math.round(igv * 100) / 100,
    total: precioFinal,
  };
}

// Formatear como soles
export function formatSoles(amount) {
  if (amount === null || amount === undefined) return 'S/. 0.00';
  return `S/. ${Number(amount).toFixed(2)}`;
}

// Formatear fecha legible
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Verificar si hoy es cumpleaños de un paciente
export function esCumpleanosHoy(fechaNac) {
  if (!fechaNac) return false;
  const hoy = new Date();
  const nac = new Date(fechaNac);
  return nac.getDate() === hoy.getDate() && nac.getMonth() === hoy.getMonth();
}

// Verificar si el cumpleaños es en los próximos N días
export function cumpleanosProximo(fechaNac, dias = 7) {
  if (!fechaNac) return false;
  const hoy = new Date();
  const nac = new Date(fechaNac);
  const proxCump = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
  if (proxCump < hoy) proxCump.setFullYear(hoy.getFullYear() + 1);
  const diff = (proxCump - hoy) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= dias;
}

// Verificar si un paciente es menor de edad (menos de 18 años)
export function esMenorDeEdad(fechaNac) {
  if (!fechaNac) return false;
  const hoy = new Date();
  const nac = new Date(fechaNac);
  const edad = hoy.getFullYear() - nac.getFullYear();
  const cumpleEsteAno = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
  return edad < 18 || (edad === 18 && hoy < cumpleEsteAno);
}

// Iniciales de nombre
export function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// Servicios disponibles
export const SERVICIOS = [
  { id: 'entrada', label: 'Sesión de Entrada', precio: PRECIO_SESION_ENTRADA },
  { id: 'paquete4', label: 'Paquete 4 Sesiones', precio: PRECIO_PAQUETE_4 },
  { id: 'sesion_suelta', label: 'Sesión Individual', precio: 0 },
];

// Categorías de gastos
export const CATEGORIAS_GASTO = [
  'Alquiler', 'Servicios básicos', 'Suministros de oficina',
  'Marketing', 'Honorarios', 'Mantenimiento', 'Capacitación', 'Otros'
];
