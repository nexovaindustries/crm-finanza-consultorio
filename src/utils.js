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

// Parsear una fecha "YYYY-MM-DD" como fecha local (evita el corrimiento por UTC)
export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Formatear fecha legible
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Verificar si hoy es cumpleaños de un paciente
export function esCumpleanosHoy(fechaNac) {
  if (!fechaNac) return false;
  const hoy = new Date();
  const nac = parseLocalDate(fechaNac);
  return nac.getDate() === hoy.getDate() && nac.getMonth() === hoy.getMonth();
}

// Verificar si el cumpleaños es en los próximos N días
export function cumpleanosProximo(fechaNac, dias = 7) {
  if (!fechaNac) return false;
  const hoy = new Date();
  const nac = parseLocalDate(fechaNac);
  const proxCump = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
  if (proxCump < hoy) proxCump.setFullYear(hoy.getFullYear() + 1);
  const diff = (proxCump - hoy) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= dias;
}

// Verificar si un paciente es menor de edad (menos de 18 años)
export function esMenorDeEdad(fechaNac) {
  if (!fechaNac) return false;
  const hoy = new Date();
  const nac = parseLocalDate(fechaNac);
  const edad = hoy.getFullYear() - nac.getFullYear();
  const cumpleEsteAno = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
  return edad < 18 || (edad === 18 && hoy < cumpleEsteAno);
}

// Dado el listado completo de citas, calcula qué número de sesión de paquete
// le corresponde a cada cita tipo 'paquete4' de un paciente (1/4, 2/4, ...).
// Al completarse 4 sesiones, la siguiente cita inicia un nuevo paquete (1/4 otra vez).
export function getSesionesPaquete(appointments, tamanoPaquete = 4) {
  const porPaciente = {};
  const ordenadas = [...appointments]
    .filter(a => a.tipo === 'paquete4' && a.estado !== 'cancelada')
    .sort((a, b) => {
      const da = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
      const db_ = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
      return da - db_;
    });

  const sesionPorCita = {};
  ordenadas.forEach(a => {
    const count = (porPaciente[a.pacienteId] || 0) + 1;
    porPaciente[a.pacienteId] = count;
    sesionPorCita[a.id] = { sesion: ((count - 1) % tamanoPaquete) + 1, total: tamanoPaquete };
  });
  return sesionPorCita;
}

// Edad legible en años y meses, ej: "8 años, 4 meses" o "7 meses" para bebés
export function getEdadTexto(fechaNac) {
  if (!fechaNac) return '—';
  const nac = parseLocalDate(fechaNac);
  const hoy = new Date();
  let years = hoy.getFullYear() - nac.getFullYear();
  let months = hoy.getMonth() - nac.getMonth();
  if (hoy.getDate() < nac.getDate()) months--;
  if (months < 0) { years--; months += 12; }

  const partes = [];
  if (years > 0) partes.push(`${years} ${years === 1 ? 'año' : 'años'}`);
  if (months > 0 || years === 0) partes.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
  return partes.join(', ');
}

// Grados escolares (sistema peruano) en orden ascendente
export const GRADOS_ESCOLARES = [
  'Inicial 3 años', 'Inicial 4 años', 'Inicial 5 años',
  '1° Primaria', '2° Primaria', '3° Primaria', '4° Primaria', '5° Primaria', '6° Primaria',
  '1° Secundaria', '2° Secundaria', '3° Secundaria', '4° Secundaria', '5° Secundaria',
];

// Año escolar vigente (el año escolar peruano corre de marzo a diciembre;
// en enero/febrero todavía se considera el grado del año anterior)
export function getAnioEscolarActual() {
  const hoy = new Date();
  return hoy.getMonth() >= 2 ? hoy.getFullYear() : hoy.getFullYear() - 1;
}

// Calcula el grado actual avanzando automáticamente un nivel por cada año escolar
// transcurrido desde que se registró `grado` (referenciado a `anioReferencia`).
export function getGradoActual(grado, anioReferencia) {
  if (!grado) return null;
  const idxBase = GRADOS_ESCOLARES.indexOf(grado);
  if (idxBase === -1) return grado;
  const anios = getAnioEscolarActual() - (anioReferencia || getAnioEscolarActual());
  const idxActual = idxBase + anios;
  if (idxActual >= GRADOS_ESCOLARES.length) return 'Egresado/a';
  if (idxActual < 0) return GRADOS_ESCOLARES[0];
  return GRADOS_ESCOLARES[idxActual];
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
