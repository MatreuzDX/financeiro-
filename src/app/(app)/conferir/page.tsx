import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, CircleHelp } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { estadoDasContas, historico } from "@/server/reconciliacao";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { formatShort, todayIso } from "@/lib/date";
import { ConferirForm } from "./conferir-form";

export const metadata: Metadata = { title: "Conferir com o banco" };

/**
 * A página que impede a app de se afastar da realidade sem ninguém dar conta.
 *
 * A diferença entre a app e o extrato cresce devagar: um levantamento
 * esquecido, uma comissão de €1,20, um movimento importado a dobrar. Nenhum é
 * um erro do programa e todos afastam os números da verdade — até deixarem de
 * servir para decidir seja o que for.
 *
 * O perigo não é a diferença de hoje. É os quatro meses sem ninguém olhar.
 */
export default async function ConferirPage() {
  const session = await requireSession("/conferir");
  const hoje = todayIso(session.timezone);

  const [contas, anteriores] = await Promise.all([
    estadoDasContas(session.workspaceId, session.timezone),
    historico(session.workspaceId),
  ]);

  if (contas.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Conferir com o banco" />
        <EmptyState
          title="Ainda não há contas"
          description="Crie a conta onde tem o dinheiro e depois volte aqui para comparar o saldo com o extrato."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conferir com o banco"
        description="O banco diz X, a app diz Y — e a diferença é a resposta"
      />

      {/* ── Estado de cada conta ───────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Há quanto tempo não confere"
          hint="O perigo não é a diferença de hoje, é os meses sem ninguém olhar"
        />
        <ul className="divide-y divide-line">
          {contas.map((c) => {
            const nunca = c.diasSemConferir === null;
            const velho = (c.diasSemConferir ?? 0) > 45;
            const Icone = nunca ? CircleHelp : velho ? CircleAlert : CheckCircle2;
            const cor = nunca
              ? "text-faint"
              : velho
                ? "text-warning"
                : c.ultima?.bateu
                  ? "text-positive"
                  : "text-warning";

            return (
              <li key={c.accountId} className="flex items-center gap-3 py-2.5">
                <Icone size={16} className={`shrink-0 ${cor}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{c.nome}</p>
                  <p className="text-[11px] text-muted">
                    {nunca
                      ? "Nunca foi conferida"
                      : `Conferida a ${formatShort(c.ultima!.date)}` +
                        (c.diasSemConferir! > 0
                          ? ` · há ${c.diasSemConferir} dia${c.diasSemConferir === 1 ? "" : "s"}`
                          : " · hoje") +
                        (c.ultima!.bateu
                          ? " · bateu certo"
                          : ` · ${formatCents(Math.abs(c.ultima!.diffCents))} de diferença`)}
                  </p>
                </div>
                <span className="tabular shrink-0 text-sm text-ink">
                  {formatCents(c.appCents)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <ConferirForm
        contas={contas.map((c) => ({
          id: c.accountId,
          nome: c.nome,
          appCents: c.appCents,
        }))}
        hoje={hoje}
      />

      {/* ── Histórico ──────────────────────────────────────────────────── */}
      {anteriores.length > 0 ? (
        <Card>
          <CardHeader title="Verificações anteriores" />
          <ul className="divide-y divide-line">
            {anteriores.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    h.diffCents === 0 ? "bg-positive" : "bg-warning"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink">
                    {h.account.name} · {formatShort(h.dateIso)}
                  </p>
                  {h.notes ? (
                    <p className="truncate text-[11px] text-muted">{h.notes}</p>
                  ) : null}
                </div>
                <span
                  className={`tabular shrink-0 text-xs ${
                    h.diffCents === 0 ? "text-positive" : "text-warning"
                  }`}
                >
                  {h.diffCents === 0
                    ? "certo"
                    : formatCents(Math.abs(h.diffCents))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">
          Porque é que isto vale o minuto que demora
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Mesmo com tudo bem registado, a app afasta-se do banco: esquece-se um
          levantamento em dinheiro, o banco cobra uma comissão de €1,20 que
          ninguém lançou, um movimento entra a dobrar por dois ficheiros com
          formatos diferentes. Nenhum destes é um defeito do programa.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          A diferença cresce devagar e um dia os números deixam de servir para
          decidir nada — mas continuam a parecer certos, que é a parte
          perigosa. Uma vez por mês chega.
        </p>
      </Card>
    </div>
  );
}
