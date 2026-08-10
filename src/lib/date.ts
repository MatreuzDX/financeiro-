/**
 * Datas sem hora, sem fuso, sem surpresas.
 *
 * PORQUÊ NÃO USAR date-fns AQUI: as funções do date-fns operam em hora LOCAL.
 * As colunas `@db.Date` do Prisma são lidas e escritas em UTC à meia-noite.
 * Misturar as duas coisas dá um bug silencioso de um dia:
 *
 *   máquina em Europe/London (BST, UTC+1)
 *   2026-08-01T00:00Z  →  01:00 do dia 1 em local
 *   startOfMonth(local) →  00:00 do dia 1 local  =  2026-07-31T23:00Z
 *   .toISOString()      →  "2026-07-31"          ✗ mês errado
 *
 * Por isso: tudo aqui é aritmética em UTC sobre strings "YYYY-MM-DD".
 * O "hoje" é calculado no fuso do utilizador (Europe/Lisbon por omissão),
 * não no fuso da máquina onde o servidor calha estar.
 */

export type IsoDate = string; // "YYYY-MM-DD"

export const DEFAULT_TIMEZONE = "Europe/Lisbon";

const isoFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = isoFormatters.get(timeZone);
  if (!f) {
    // "en-CA" produz exatamente YYYY-MM-DD.
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    isoFormatters.set(timeZone, f);
  }
  return f;
}

/** O dia de hoje no fuso do utilizador. */
export function todayIso(timeZone: string = DEFAULT_TIMEZONE): IsoDate {
  return formatterFor(timeZone).format(new Date());
}

export function isValidIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && toIso(d) === value;
}

/** "YYYY-MM-DD" → Date à meia-noite UTC (o que o Prisma espera em @db.Date). */
export function fromIso(value: IsoDate): Date {
  if (!isValidIsoDate(value)) {
    throw new Error(`Data inválida: ${value}`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date → "YYYY-MM-DD", sempre pela parte UTC. */
export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const d = fromIso(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function addMonths(value: IsoDate, months: number): IsoDate {
  const d = fromIso(value);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 de janeiro + 1 mês = 28/29 de fevereiro, não 3 de março.
  const lastDay = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  d.setUTCDate(Math.min(day, lastDay));
  return toIso(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function startOfMonth(value: IsoDate): IsoDate {
  return `${value.slice(0, 7)}-01`;
}

export function endOfMonth(value: IsoDate): IsoDate {
  const d = fromIso(value);
  const last = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  return `${value.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Semana a começar à SEGUNDA-FEIRA, como em Portugal. */
export function startOfWeek(value: IsoDate): IsoDate {
  const d = fromIso(value);
  const dow = d.getUTCDay(); // 0 = domingo
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDays(value, delta);
}

export function endOfWeek(value: IsoDate): IsoDate {
  return addDays(startOfWeek(value), 6);
}

export function startOfYear(value: IsoDate): IsoDate {
  return `${value.slice(0, 4)}-01-01`;
}

export function endOfYear(value: IsoDate): IsoDate {
  return `${value.slice(0, 4)}-12-31`;
}

export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round(
    (fromIso(to).getTime() - fromIso(from).getTime()) / 86_400_000,
  );
}

export function minIso(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

export function maxIso(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

// ─── Apresentação ──────────────────────────────────────────────────────────

const longDate = new Intl.DateTimeFormat("pt-PT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDate = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const dayMonth = new Intl.DateTimeFormat("pt-PT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const monthYear = new Intl.DateTimeFormat("pt-PT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const monthShort = new Intl.DateTimeFormat("pt-PT", {
  month: "short",
  timeZone: "UTC",
});

const weekdayLong = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  timeZone: "UTC",
});

export function formatLong(value: IsoDate): string {
  return longDate.format(fromIso(value));
}

export function formatShort(value: IsoDate): string {
  return shortDate.format(fromIso(value));
}

export function formatDayMonth(value: IsoDate): string {
  return dayMonth.format(fromIso(value));
}

export function formatMonthYear(value: IsoDate): string {
  const s = monthYear.format(fromIso(value));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatMonthShort(value: IsoDate): string {
  return monthShort.format(fromIso(value)).replace(".", "");
}

export function formatWeekday(value: IsoDate): string {
  const s = weekdayLong.format(fromIso(value));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Hoje", "Ontem" ou a data por extenso — para agrupar listas. */
export function formatRelativeDay(
  value: IsoDate,
  today: IsoDate = todayIso(),
): string {
  if (value === today) return "Hoje";
  if (value === addDays(today, -1)) return "Ontem";
  if (value === addDays(today, 1)) return "Amanhã";
  const sameYear = value.slice(0, 4) === today.slice(0, 4);
  return sameYear
    ? `${formatWeekday(value)}, ${formatDayMonth(value)}`
    : formatShort(value);
}
