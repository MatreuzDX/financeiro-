import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/guard";
import { ganhoReal, porDiaDaSemana } from "@/server/ganho-real";
import { resolvePeriod } from "@/lib/period";
import { todayIso } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { Card, CardHeader, EmptyState, InfoNote, PageHeader } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";

export const metadata: Metadata = { title: "Ganho real" };

export default async function GanhoRealPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/ganho-real");
  const params = await searchParams;
  const period = resolvePeriod({
    periodo: params.periodo ?? "mes",
    de: params.de,
    ate: params.ate,
    today: todayIso(session.timezone),
  });

  const [g, dias] = await Promise.all([
    ganhoReal(session.workspaceId, session.timezone, {
      from: period.from,
      to: period.to,
    }),
    porDiaDaSemana(session.workspaceId, { from: period.from, to: period.to }),
  ]);

  if (g.trabalhos === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Ganho real"
          description="Quanto ganha mesmo, depois de tudo"
        />
        <PeriodPicker current={period.key} from={period.from} to={period.to} />
        <EmptyState
          title="Ainda não há trabalhos neste período"
          description="Esta página faz uma conta simples: pega no que os trabalhos renderam e tira o combustível, o desgaste do veículo e os impostos. Registe um trabalho para a ver."
        />
        <Link
          href="/trabalhos"
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          Ir aos trabalhos →
        </Link>
      </div>
    );
  }

  const horas = g.horasDecimos / 10;
  const melhor = [...dias]
    .filter((d) => d.brutoPorHoraCents !== null)
    .sort((a, b) => (b.brutoPorHoraCents ?? 0) - (a.brutoPorHoraCents ?? 0))[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ganho real"
        description="Quanto ganha mesmo, depois de tudo"
      />

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      {/* ── O número ──────────────────────────────────────────────────── */}
      <Card className="p-5 text-center">
        {g.liquidoPorHoraCents === null ? (
          <>
            <p className="text-sm text-muted">
              Não consigo dizer o ganho por hora
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Nenhum dos {g.trabalhos} trabalhos deste período tem horas
              registadas. Sem horas não há divisão, e inventar um número aqui
              seria pior do que não o dar.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-muted">
              Ganha mesmo, por hora
            </p>
            <p className="tabular mt-1 text-3xl font-semibold text-ink">
              {formatCents(g.liquidoPorHoraCents)}
            </p>
            {g.brutoPorHoraCents !== null &&
            g.brutoPorHoraCents !== g.liquidoPorHoraCents ? (
              <p className="mt-2 text-xs leading-relaxed text-muted">
                O bruto dá {formatCents(g.brutoPorHoraCents)} por hora. A
                diferença — <strong className="text-ink">{g.percentagemPerdida}%</strong>{" "}
                — é o veículo e os impostos.
              </p>
            ) : null}
          </>
        )}
      </Card>

      {/* ── A conta, linha a linha ────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="A conta"
          hint={`${g.trabalhos} trabalho${g.trabalhos === 1 ? "" : "s"}${
            horas > 0 ? ` · ${horas.toLocaleString("pt-PT")} h` : ""
          }${g.metros > 0 ? ` · ${(g.metros / 1000).toLocaleString("pt-PT", { maximumFractionDigits: 0 })} km` : ""}`}
        />
        <ul className="divide-y divide-line text-sm">
          <Linha rotulo="Renderam" valor={g.brutoCents} />
          <Linha rotulo="Veículo" valor={-g.custosVeiculoCents} nota="Combustível, manutenção, seguro — tudo o que lançou contra um veículo" />
          <Linha rotulo="Impostos" valor={-g.impostosCents} nota="IVA, Segurança Social e IRS sobre esta receita" />
          <li className="flex items-baseline justify-between gap-3 pt-2.5">
            <span className="font-medium text-ink">Fica para si</span>
            <span
              className={`tabular text-base font-semibold ${
                g.liquidoCents >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {formatCents(g.liquidoCents)}
            </span>
          </li>
        </ul>
      </Card>

      {g.liquidoPorKmCents !== null ? (
        <Card className="p-4">
          <p className="text-xs text-muted">Por quilómetro, já limpo</p>
          <p className="tabular mt-0.5 text-lg font-semibold text-ink">
            {formatCents(g.liquidoPorKmCents)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            É este o número que interessa quando lhe oferecem uma entrega e tem
            de decidir se compensa.
          </p>
        </Card>
      ) : null}

      {/* ── Onde está o dinheiro ──────────────────────────────────────── */}
      {dias.length > 1 ? (
        <Card>
          <CardHeader
            title="Que dias rendem mais"
            hint="Bruto por hora, por dia da semana"
          />
          <ul className="space-y-1.5">
            {dias.map((d) => {
              const max = Math.max(...dias.map((x) => x.brutoPorHoraCents ?? 0));
              const largura =
                max > 0 ? ((d.brutoPorHoraCents ?? 0) / max) * 100 : 0;
              return (
                <li key={d.dia} className="flex items-center gap-2.5">
                  <span className="w-16 shrink-0 text-xs text-muted">{d.dia}</span>
                  <span className="h-5 flex-1 overflow-hidden rounded-md bg-surface-2">
                    <span
                      className="block h-full rounded-md bg-primary/70"
                      style={{ width: `${largura}%` }}
                    />
                  </span>
                  <span className="tabular w-16 shrink-0 text-right text-xs text-ink">
                    {d.brutoPorHoraCents === null
                      ? "—"
                      : formatCents(d.brutoPorHoraCents)}
                  </span>
                </li>
              );
            })}
          </ul>
          {melhor ? (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              O melhor dia é <strong className="text-ink">{melhor.dia.toLowerCase()}</strong>,
              a {formatCents(melhor.brutoPorHoraCents!)} por hora. Se puder
              escolher quando trabalha, é aí que já está a ganhar mais — sem
              trabalhar mais.
            </p>
          ) : null}
        </Card>
      ) : null}

      <InfoNote>
        Os custos do veículo contam <strong>o que lançou contra um veículo</strong>{" "}
        — combustível, revisões, seguro, pneus. Despesas pessoais não entram,
        senão a conta ficava falsamente má. Se registar os abastecimentos, este
        número aproxima-se muito da realidade.
      </InfoNote>

      <p className="text-[11px] leading-relaxed text-faint">
        Só se compara por dia da semana, não por hora do dia: a app regista a
        data de um trabalho, não a hora a que começou. Adivinhá-la pelo momento
        do registo daria uma resposta errada com ar de certa.
      </p>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: number;
  nota?: string;
}) {
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-ink">{rotulo}</span>
        <span
          className={`tabular font-medium ${
            valor < 0 ? "text-negative" : "text-ink"
          }`}
        >
          {formatCents(valor)}
        </span>
      </div>
      {nota ? <p className="mt-0.5 text-[11px] text-muted">{nota}</p> : null}
    </li>
  );
}
