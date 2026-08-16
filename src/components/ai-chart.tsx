"use client";

import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCents, formatCentsShort } from "@/lib/money";
import type { Grafico } from "@/server/ai/tools";

/**
 * O gráfico que o assistente escolheu.
 *
 * Não é ele que desenha — é ele que decide QUAL, chamando a ferramenta certa.
 * Círculo para "para onde foi", linha para evolução, barras para comparar.
 * A escolha errada de gráfico esconde a resposta tão bem como não a dar.
 */

const CORES = [
  "var(--primary)",
  "var(--positive)",
  "var(--warning)",
  "var(--negative)",
  "#8b7cf6",
  "#14b8a6",
  "#f472b6",
  "#94a3b8",
];

const eixo = {
  stroke: "var(--faint)",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
};

function Caixa({ ativo, valor, nome }: { ativo?: boolean; valor?: number; nome?: string }) {
  if (!ativo || valor === undefined) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm">
      {nome ? <p className="text-muted">{nome}</p> : null}
      <p className="tabular font-medium text-ink">{formatCents(valor)}</p>
    </div>
  );
}

export function AiChart({ grafico }: { grafico: Grafico }) {
  return (
    <figure className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
      <figcaption className="mb-2 text-[11px] font-medium text-muted">
        {grafico.titulo}
      </figcaption>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {grafico.tipo === "circulo" ? (
            <PieChart>
              <Pie
                data={grafico.fatias.map((f) => ({ name: f.rotulo, value: f.cents }))}
                dataKey="value"
                nameKey="name"
                innerRadius="52%"
                outerRadius="80%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {grafico.fatias.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => (
                  <Caixa
                    ativo={active}
                    valor={payload?.[0]?.value as number}
                    nome={payload?.[0]?.name as string}
                  />
                )}
              />
            </PieChart>
          ) : grafico.tipo === "linha" ? (
            <LineChart
              data={grafico.pontos.map((p) => ({
                name: p.rotulo,
                entrou: p.entrouCents,
                saiu: p.saiuCents,
              }))}
              margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
            >
              <XAxis dataKey="name" {...eixo} />
              <YAxis {...eixo} tickFormatter={(v) => formatCentsShort(Number(v))} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm">
                      <p className="mb-0.5 text-muted">{label}</p>
                      {payload.map((p) => (
                        <p key={p.name} className="tabular text-ink">
                          {p.name === "entrou" ? "Entrou" : "Saiu"}:{" "}
                          {formatCents(Number(p.value))}
                        </p>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Line
                type="monotone"
                dataKey="entrou"
                stroke="var(--positive)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="saiu"
                stroke="var(--negative)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : (
            <BarChart
              data={grafico.pontos.map((p) => ({ name: p.rotulo, value: p.cents }))}
              margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
            >
              <XAxis dataKey="name" {...eixo} />
              <YAxis {...eixo} tickFormatter={(v) => formatCentsShort(Number(v))} />
              <Tooltip
                cursor={{ fill: "var(--surface-hover)" }}
                content={({ active, payload, label }) => (
                  <Caixa
                    ativo={active}
                    valor={payload?.[0]?.value as number}
                    nome={label as string}
                  />
                )}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {grafico.pontos.map((p, i) => (
                  <Cell
                    key={i}
                    fill={p.cents < 0 ? "var(--negative)" : CORES[i % CORES.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
