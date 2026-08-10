/**
 * Períodos de análise. Um só sítio a decidir o que é "este mês", para que o
 * dashboard, os gráficos e os relatórios nunca discordem entre si.
 *
 * Cada período traz também o período ANTERIOR de igual duração — é o que
 * permite mostrar "+12% face ao mês passado" sem cada ecrã inventar o seu
 * próprio critério.
 */

import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  formatMonthYear,
  formatShort,
  isValidIsoDate,
  startOfMonth,
  startOfWeek,
  startOfYear,
  todayIso,
  type IsoDate,
} from "./date";

export const PERIOD_KEYS = [
  "hoje",
  "semana",
  "mes",
  "mes-anterior",
  "3-meses",
  "semestre",
  "ano",
  "personalizado",
] as const;

export type PeriodKey = (typeof PERIOD_KEYS)[number];

export type Period = {
  key: PeriodKey;
  label: string;
  from: IsoDate;
  to: IsoDate;
  /** Período imediatamente anterior, com a mesma duração. */
  previous: { from: IsoDate; to: IsoDate };
};

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  "mes-anterior": "Mês anterior",
  "3-meses": "Últimos 3 meses",
  semestre: "Últimos 6 meses",
  ano: "Este ano",
  personalizado: "Personalizado",
};

function previousOf(from: IsoDate, to: IsoDate): { from: IsoDate; to: IsoDate } {
  const days = diffDays(from, to) + 1;
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

export function isPeriodKey(value: unknown): value is PeriodKey {
  return (
    typeof value === "string" && (PERIOD_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Resolve o período a partir dos parâmetros da URL. Manter o período na URL
 * (em vez de em estado do React) faz com que o botão "voltar" funcione e que
 * um link partilhado mostre exatamente o mesmo que a pessoa estava a ver.
 */
export function resolvePeriod(params: {
  periodo?: string | null;
  de?: string | null;
  ate?: string | null;
  today?: IsoDate;
}): Period {
  const today = params.today ?? todayIso();
  const key: PeriodKey = isPeriodKey(params.periodo) ? params.periodo : "mes";

  if (key === "personalizado") {
    const from =
      params.de && isValidIsoDate(params.de) ? params.de : startOfMonth(today);
    const rawTo =
      params.ate && isValidIsoDate(params.ate) ? params.ate : today;
    // Datas trocadas não devem dar uma lista vazia sem explicação.
    const [f, t] = from <= rawTo ? [from, rawTo] : [rawTo, from];
    return {
      key,
      label: `${formatShort(f)} – ${formatShort(t)}`,
      from: f,
      to: t,
      previous: previousOf(f, t),
    };
  }

  let from: IsoDate;
  let to: IsoDate;
  let label: string = PERIOD_LABELS[key];

  switch (key) {
    case "hoje":
      from = today;
      to = today;
      break;
    case "semana":
      from = startOfWeek(today);
      to = endOfWeek(today);
      break;
    case "mes-anterior": {
      const prev = addMonths(startOfMonth(today), -1);
      from = startOfMonth(prev);
      to = endOfMonth(prev);
      label = formatMonthYear(from);
      break;
    }
    case "3-meses":
      from = startOfMonth(addMonths(startOfMonth(today), -2));
      to = endOfMonth(today);
      break;
    case "semestre":
      from = startOfMonth(addMonths(startOfMonth(today), -5));
      to = endOfMonth(today);
      break;
    case "ano":
      from = startOfYear(today);
      to = endOfYear(today);
      break;
    case "mes":
    default:
      from = startOfMonth(today);
      to = endOfMonth(today);
      label = formatMonthYear(from);
      break;
  }

  return { key, label, from, to, previous: previousOf(from, to) };
}

/** Reconstrói a query string do período, para links que o preservam. */
export function periodToQuery(period: Period): string {
  if (period.key === "personalizado") {
    return `periodo=personalizado&de=${period.from}&ate=${period.to}`;
  }
  return `periodo=${period.key}`;
}

/**
 * Divide o período em fatias para os gráficos de evolução: por dia quando é
 * curto, por mês quando é longo. Sem isto, um ano inteiro daria 365 barras
 * ilegíveis num ecrã de telemóvel.
 */
export function bucketsFor(
  period: Period,
): { key: string; label: string; from: IsoDate; to: IsoDate }[] {
  const totalDays = diffDays(period.from, period.to) + 1;
  const buckets: { key: string; label: string; from: IsoDate; to: IsoDate }[] = [];

  if (totalDays <= 31) {
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(period.from, i);
      buckets.push({ key: d, label: d.slice(8), from: d, to: d });
    }
    return buckets;
  }

  let cursor = startOfMonth(period.from);
  while (cursor <= period.to) {
    const from = cursor < period.from ? period.from : cursor;
    const monthEnd = endOfMonth(cursor);
    const to = monthEnd > period.to ? period.to : monthEnd;
    buckets.push({
      key: cursor.slice(0, 7),
      label: formatMonthYear(cursor).split(" ")[0].slice(0, 3),
      from,
      to,
    });
    cursor = addMonths(cursor, 1);
  }
  return buckets;
}
