"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents, formatCentsShort } from "@/lib/money";
import { EmptyState } from "@/components/ui";

/**
 * Gráficos.
 *
 * As cores vêm das variáveis CSS do tema (`var(--positive)`, …) e não de
 * valores fixos — senão o modo escuro fica com barras invisíveis, que foi
 * exatamente o erro cometido no projeto anterior.
 */

const AXIS = { stroke: "transparent", tickLine: false, axisLine: false } as const;

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-[var(--shadow-lg)]">
      {label ? (
        <p className="mb-1 text-[11px] font-medium text-muted">{label}</p>
      ) : null}
      {payload.map((item, i) => (
        <p key={i} className="flex items-center gap-2 text-xs text-ink">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: item.color }}
            aria-hidden
          />
          <span className="text-muted">{item.name}</span>
          <span className="tabular ml-auto font-medium">
            {formatCents(item.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  );
}

export type SeriesPoint = {
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
};

export function IncomeExpenseChart({ data }: { data: SeriesPoint[] }) {
  if (data.every((d) => d.incomeCents === 0 && d.expenseCents === 0)) {
    return (
      <EmptyState
        title="Ainda sem movimentos neste período"
        description="Assim que registar receitas ou despesas, a comparação aparece aqui."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} tickFormatter={(v: number) => formatCentsShort(v)} width={54} />
        <Tooltip
          content={<MoneyTooltip />}
          cursor={{ fill: "var(--surface-2)" }}
        />
        <Bar
          dataKey="incomeCents"
          name="Entrou"
          fill="var(--positive)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="expenseCents"
          name="Saiu"
          fill="var(--negative)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BalanceChart({ data }: { data: SeriesPoint[] }) {
  if (data.length < 2) {
    return (
      <EmptyState
        title="Ainda não há histórico suficiente"
        description="A evolução do saldo aparece assim que houver movimentos em pelo menos dois dias."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} tickFormatter={(v: number) => formatCentsShort(v)} width={54} />
        <Tooltip content={<MoneyTooltip />} />
        <Area
          type="monotone"
          dataKey="balanceCents"
          name="Saldo"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#saldoFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export type Slice = { name: string; cents: number; color: string | null };

const FALLBACK_COLORS = [
  "#0ea5e9",
  "#f97316",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
  "#eab308",
  "#64748b",
];

export function CategoryDonut({ data }: { data: Slice[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sem despesas neste período"
        description="Quando registar despesas, aparece aqui para onde foi o dinheiro."
      />
    );
  }

  const total = data.reduce((s, d) => s + d.cents, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="cents"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="none"
            >
              {data.map((slice, i) => (
                <Cell
                  key={slice.name}
                  fill={slice.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<MoneyTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-[10px] text-muted">Total</p>
            <p className="tabular text-sm font-semibold text-ink">
              {formatCents(total)}
            </p>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-1.5">
        {data.slice(0, 6).map((slice, i) => (
          <li key={slice.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                background:
                  slice.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
              }}
              aria-hidden
            />
            <span className="truncate text-muted">{slice.name}</span>
            <span className="tabular ml-auto shrink-0 font-medium text-ink">
              {formatCents(slice.cents)}
            </span>
            <span className="tabular w-9 shrink-0 text-right text-faint">
              {total > 0 ? Math.round((slice.cents / total) * 100) : 0}%
            </span>
          </li>
        ))}
        {data.length > 6 ? (
          <li className="pt-1 text-[11px] text-faint">
            e mais {data.length - 6} categoria{data.length - 6 === 1 ? "" : "s"}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export function SourceBars({ data }: { data: Slice[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sem receitas neste período"
        description="Registe uma receita ou um trabalho para ver quanto rendeu cada fonte."
      />
    );
  }

  const max = Math.max(...data.map((d) => d.cents), 1);

  return (
    <ul className="space-y-3">
      {data.map((item, i) => (
        <li key={item.name}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-ink">{item.name}</span>
            <span className="tabular shrink-0 text-muted">
              {formatCents(item.cents)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${(item.cents / max) * 100}%`,
                background:
                  item.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
