import type { Metadata } from "next";
import { Archive, Trophy } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { listGoals } from "@/server/goals";
import { todayIso, formatLong } from "@/lib/date";
import { formatCents } from "@/lib/money";
import {
  Badge,
  Card,
  EmptyState,
  InfoNote,
  PageHeader,
  ProgressBar,
} from "@/components/ui";
import { ContributionForm, NewGoalForm } from "./goal-forms";
import { archiveGoalAction } from "./actions";

export const metadata: Metadata = { title: "Metas" };

export default async function MetasPage() {
  const session = await requireSession("/metas");
  const today = todayIso(session.timezone);
  const metas = await listGoals(session.workspaceId, session.timezone);

  const totalGuardado = metas.reduce((s, m) => s + m.savedCents, 0);
  const totalObjetivo = metas.reduce((s, m) => s + m.targetCents, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Metas"
        description="Dinheiro com destino. O que está de lado, e para quê."
      />

      {metas.length > 0 ? (
        <Card className="animate-rise">
          <p className="text-xs font-medium text-muted">Guardado no total</p>
          <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-ink">
            {formatCents(totalGuardado)}
          </p>
          <p className="mt-1 text-xs text-muted">
            de {formatCents(totalObjetivo)} em {metas.length} meta
            {metas.length === 1 ? "" : "s"}
          </p>
        </Card>
      ) : null}

      <NewGoalForm today={today} />

      {metas.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Trophy size={26} aria-hidden />}
            title="Ainda sem metas"
            description="Um objetivo com nome e valor muda a forma como se poupa: deixa de ser 'sobrar dinheiro' e passa a ser juntar para alguma coisa."
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {metas.map((meta) => (
            <li key={meta.id}>
              <Card className="animate-rise">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span className="truncate">{meta.name}</span>
                      {meta.concluida ? (
                        <Badge tone="positive">Conseguida</Badge>
                      ) : null}
                    </h2>
                    {meta.deadline ? (
                      <p className="text-[11px] text-muted">
                        Até {formatLong(meta.deadline)}
                      </p>
                    ) : null}
                  </div>

                  <form action={archiveGoalAction} className="shrink-0">
                    <input type="hidden" name="id" value={meta.id} />
                    <button
                      type="submit"
                      title="Arquivar meta"
                      aria-label={`Arquivar ${meta.name}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-hover hover:text-ink"
                    >
                      <Archive size={15} aria-hidden />
                    </button>
                  </form>
                </div>

                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="tabular font-semibold text-ink">
                    {formatCents(meta.savedCents)}
                  </span>
                  <span className="tabular text-xs text-muted">
                    de {formatCents(meta.targetCents)}
                  </span>
                </div>

                <ProgressBar
                  percent={meta.percent}
                  tone={meta.concluida ? "primary" : "primary"}
                />

                <p className="mt-1.5 text-[11px] text-muted">
                  {meta.concluida
                    ? "Objetivo atingido."
                    : `Faltam ${formatCents(meta.faltaCents)} · ${meta.percent}%`}
                </p>

                {/* ── O que a app sabe, e o que não sabe ──────────────── */}
                {!meta.concluida ? (
                  <div className="mt-3 space-y-1.5 border-l-2 border-line pl-3 text-[11px] leading-relaxed text-muted">
                    {meta.precisoPorMesCents !== null ? (
                      <p>
                        Para chegar lá no prazo, precisa de pôr{" "}
                        <strong className="tabular text-ink">
                          {formatCents(meta.precisoPorMesCents)}
                        </strong>{" "}
                        por mês.
                      </p>
                    ) : null}

                    {meta.ritmoMensalCents !== null ? (
                      <p>
                        Ao ritmo a que tem ido —{" "}
                        <strong className="tabular text-ink">
                          {formatCents(meta.ritmoMensalCents)}
                        </strong>{" "}
                        por mês —
                        {meta.previsaoIso
                          ? ` chega lá por volta de ${formatLong(meta.previsaoIso)}.`
                          : " ainda vai demorar muito para lá chegar."}
                      </p>
                    ) : (
                      <p>
                        Ainda não dá para estimar o ritmo. São precisas pelo
                        menos duas contribuições com duas semanas de intervalo —
                        e prefiro dizer isto do que inventar uma data.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="mt-3">
                  <ContributionForm
                    goalId={meta.id}
                    goalName={meta.name}
                    today={today}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <InfoNote>
        O progresso é a soma do que registou aqui, e não o saldo de uma conta.
        Se fosse o saldo, duas metas na mesma conta mostravam ambas o dinheiro
        todo — e ficava com a ideia de ter o dobro do que tem.
      </InfoNote>
    </div>
  );
}
