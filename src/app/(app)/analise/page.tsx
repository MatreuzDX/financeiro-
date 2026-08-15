import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Info,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { analisar, GLOSSARIO, type Tom } from "@/server/insights";
import { resolvePeriod } from "@/lib/period";
import { todayIso } from "@/lib/date";
import { cn } from "@/lib/cn";
import { Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";

export const metadata: Metadata = { title: "Análise" };

const ESTILO: Record<
  Tom,
  { anel: string; icone: typeof Info; cor: string; fundo: string }
> = {
  bom: {
    anel: "border-positive/30",
    icone: CircleCheck,
    cor: "text-positive",
    fundo: "bg-positive-soft",
  },
  neutro: {
    anel: "border-line",
    icone: Info,
    cor: "text-primary",
    fundo: "bg-primary-soft",
  },
  atencao: {
    anel: "border-warning/40",
    icone: TriangleAlert,
    cor: "text-warning",
    fundo: "bg-warning-soft",
  },
  mau: {
    anel: "border-negative/40",
    icone: CircleAlert,
    cor: "text-negative",
    fundo: "bg-negative-soft",
  },
};

export default async function AnalisePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/analise");
  const params = await searchParams;
  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: params.periodo,
    de: params.de,
    ate: params.ate,
    today,
  });

  const analise = await analisar(session.workspaceId, period, session.timezone);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Análise"
        description="O que os números dizem, em palavras."
      />

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      {/* ── O parágrafo de abertura ─────────────────────────────────────── */}
      <Card className="animate-rise bg-linear-to-br from-primary-soft to-surface">
        <p className="text-sm leading-relaxed text-ink">{analise.resumo}</p>
      </Card>

      {/* ── As observações ──────────────────────────────────────────────── */}
      {analise.insights.length > 0 ? (
        <ul className="space-y-3">
          {analise.insights.map((insight) => {
            const estilo = ESTILO[insight.tom];
            const Icone = estilo.icone;
            return (
              <li key={insight.id}>
                <Card className={cn("animate-rise", estilo.anel)}>
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                        estilo.fundo,
                        estilo.cor,
                      )}
                      aria-hidden
                    >
                      <Icone size={16} />
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                      <h2 className="text-sm font-semibold text-ink">
                        {insight.titulo}
                      </h2>

                      {/* O número */}
                      <p className="text-sm leading-relaxed text-ink">
                        {insight.observacao}
                      </p>

                      {/* Porque importa — a parte que ensina */}
                      <p className="border-l-2 border-line pl-3 text-xs leading-relaxed text-muted">
                        {insight.porque}
                      </p>

                      {insight.acao ? (
                        <Link
                          href={insight.acao.href}
                          className="inline-flex items-center gap-1 pt-0.5 text-xs font-medium text-primary hover:underline"
                        >
                          {insight.acao.texto}
                          <ArrowRight size={13} aria-hidden />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {analise.semDados ? (
        <Card className="animate-rise">
          <CardHeader title="Porque está isto vazio" />
          <p className="text-xs leading-relaxed text-muted">
            Esta página não estima nada a partir de médias nacionais nem de
            perfis parecidos com o seu. Só sabe o que estiver registado — e é
            de propósito: um número que não reconhece é pior do que número
            nenhum, porque vai tomar decisões com ele.
          </p>
          <div className="mt-3">
            <LinkButton href="/movimentos/novo" size="sm">
              Registar movimento
            </LinkButton>
          </div>
        </Card>
      ) : null}

      {/* ── Glossário ───────────────────────────────────────────────────── */}
      <Card className="animate-rise">
        <CardHeader
          title="Em português claro"
          hint="Os termos que esta app usa à sua maneira"
        />
        <dl className="divide-y divide-line">
          {GLOSSARIO.map((item) => (
            <div key={item.termo} className="py-3 first:pt-0 last:pb-0">
              <dt className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <Lightbulb size={14} className="shrink-0 text-primary" aria-hidden />
                {item.termo}
              </dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted">
                {item.explicacao}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <p className="px-1 pb-2 text-[11px] leading-relaxed text-faint">
        Tudo o que está nesta página sai dos seus movimentos. Não há médias de
        outras pessoas, nem valores de referência inventados. Onde houver uma
        estimativa, está escrito que é uma estimativa e como foi calculada.
      </p>
    </div>
  );
}
