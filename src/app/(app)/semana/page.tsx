import type { Metadata } from "next";
import Link from "next/link";
import { Check, Flame, Lock } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { estadoDoHabito, resumoSemanal } from "@/server/habito";
import { formatCents } from "@/lib/money";
import { formatDayMonth } from "@/lib/date";
import { Card, CardHeader, PageHeader, ProgressBar } from "@/components/ui";

export const metadata: Metadata = { title: "A minha semana" };

/**
 * O ritual semanal.
 *
 * Quatro números e uma frase — não um relatório. A investigação sobre hábitos
 * é clara: o que traz a pessoa de volta é um momento curto e previsível, não
 * um painel cheio que dá trabalho a ler.
 */
export default async function SemanaPage() {
  const session = await requireSession("/semana");
  const [resumo, estado] = await Promise.all([
    resumoSemanal(session.workspaceId, session.timezone),
    estadoDoHabito(session.workspaceId, session.timezone),
  ]);

  const { habito } = estado;

  return (
    <div className="space-y-5">
      <PageHeader
        title="A minha semana"
        description={`${formatDayMonth(resumo.de)} a ${formatDayMonth(resumo.ate)}`}
      />

      {/* ── A sequência ───────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
              habito.atual > 0 ? "bg-warning-soft" : "bg-surface-2"
            }`}
          >
            <Flame
              size={22}
              className={habito.atual > 0 ? "text-warning" : "text-faint"}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="tabular text-xl font-semibold text-ink">
              {habito.atual} {habito.atual === 1 ? "dia" : "dias"}
            </p>
            <p className="text-xs leading-relaxed text-muted">{estado.frase}</p>
          </div>
        </div>

        <ul className="mt-3 flex justify-between gap-1">
          {habito.ultimosSete.map((d) => (
            <li key={d.dia} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`grid h-8 w-full place-items-center rounded-lg ${
                  d.feito
                    ? "bg-positive-soft text-positive"
                    : "bg-surface-2 text-faint"
                }`}
              >
                {d.feito ? <Check size={14} aria-hidden /> : "·"}
              </span>
              <span className="text-[10px] text-faint">
                {formatDayMonth(d.dia).split(" ")[0]}
              </span>
            </li>
          ))}
        </ul>

        {habito.recorde > habito.atual ? (
          <p className="mt-2.5 text-[11px] text-faint">
            O seu recorde é de {habito.recorde} dias seguidos.
          </p>
        ) : null}
      </Card>

      {/* ── Os quatro números ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <Numero rotulo="Entrou" valor={formatCents(resumo.entrouCents)} tom="positivo" />
        <Numero rotulo="Saiu" valor={formatCents(resumo.saiuCents)} tom="negativo" />
        <Numero
          rotulo="Sobrou"
          valor={formatCents(resumo.sobrouCents)}
          tom={resumo.sobrouCents >= 0 ? "positivo" : "negativo"}
        />
        <Numero
          rotulo="Dias registados"
          valor={`${resumo.diasRegistados} de 7`}
        />
      </div>

      <Card className="p-4">
        <p className="text-sm leading-relaxed text-ink">{resumo.frase}</p>
        {resumo.variacaoGastos !== null ? (
          <p className="mt-1.5 text-xs text-muted">
            Comparação com a semana anterior, gasto a gasto. Uma semana isolada
            diz pouco — o que interessa é a direção ao longo de um mês.
          </p>
        ) : null}
      </Card>

      {/* ── Medalhas ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Marcos"
          hint={`${estado.conquistadas} de ${estado.medalhas.length}`}
        />
        <ul className="space-y-2.5">
          {estado.medalhas.map((m) => (
            <li key={m.id} className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                  m.conquistada
                    ? "bg-positive-soft text-positive"
                    : "bg-surface-2 text-faint"
                }`}
              >
                {m.conquistada ? <Check size={14} aria-hidden /> : <Lock size={12} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${m.conquistada ? "text-ink" : "text-muted"}`}
                >
                  {m.titulo}
                </p>
                <p className="text-[11px] text-muted">{m.descricao}</p>
                {!m.conquistada && m.progresso > 0 ? (
                  <div className="mt-1.5">
                    <ProgressBar percent={m.progresso} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Os marcos são todos pelo <strong>hábito</strong>, nenhum pelo saldo. É
          de propósito: premiar euros poupados premeia quem já tinha dinheiro e
          empurra quem não tem para transferências que não pode fazer. Registar
          está ao alcance de toda a gente.
        </p>
      </Card>

      <p className="text-center text-xs text-muted">
        <Link href="/analise" className="font-medium text-primary hover:underline">
          Ver a análise completa →
        </Link>
      </p>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: string;
  tom?: "positivo" | "negativo";
}) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-faint">{rotulo}</p>
      <p
        className={`tabular mt-0.5 text-base font-semibold ${
          tom === "positivo"
            ? "text-positive"
            : tom === "negativo"
              ? "text-negative"
              : "text-ink"
        }`}
      >
        {valor}
      </p>
    </Card>
  );
}
