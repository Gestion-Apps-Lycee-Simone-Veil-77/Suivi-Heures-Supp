import { randomUUID } from 'node:crypto';

export function uuid() {
  return randomUUID();
}

// jj/mm/aaaa, fuseau Europe/Paris.
export function formatDateFr(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

export function formatDateTimeFr(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date).replace(',', '');
}

// yyyy-MM-dd, pour les champs "date pure" envoyés au client (DateActivite/DateAbsence).
export function formatDateISO(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date);
}

// Ramène une valeur (Date, chaîne ISO, chaîne "YYYY-MM-DD", nombre, texte...) à
// une forme comparable et lisible — équivalent de formatValueForDiff() côté Apps Script.
export function formatValueForDiff(v) {
  if (v instanceof Date) return formatDateFr(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!isNaN(d)) return formatDateFr(d);
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + 'T00:00:00');
    if (!isNaN(d)) return formatDateFr(d);
  }
  return v === undefined || v === null || v === '' ? '(vide)' : v;
}
